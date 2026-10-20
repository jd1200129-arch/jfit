import { randomInt } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

const apiKey = process.env.RESEND_API_KEY ?? '';
const from = process.env.EMAIL_FROM ?? '';
const deliveryEnabled = process.env.EMAIL_DELIVERY_ENABLED === 'true';
if (!deliveryEnabled || !process.env.DATABASE_URL || !apiKey || !from) {
  console.info(JSON.stringify({ event: 'email_worker_disabled', database: Boolean(process.env.DATABASE_URL), providerKey: Boolean(apiKey), sender: Boolean(from), explicitlyEnabled: deliveryEnabled }));
  await new Promise<void>(() => {
    const keepAlive = setInterval(() => {}, 60_000);
    const stop = () => {
      clearInterval(keepAlive);
      process.exit(0);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4, idleTimeoutMillis: 30_000 });
const maxAttempts = 8;
const pollMs = 1500;
let stopping = false;

type EmailPayload = { to: string; url: string; expiresIn: '24 hours' | '1 hour'; expiresAt: string };
type EmailJob = { id: string; topic: string; payload: EmailPayload; attempts: number };

class DeliveryError extends Error {
  constructor(readonly code: string, readonly retryable: boolean) { super(code); }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);

async function claimBatch(): Promise<EmailJob[]> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE outbox_jobs SET status='failed',locked_at=NULL,last_error='attempt_limit_exceeded'
      WHERE status='processing' AND attempts >= $1 AND locked_at<now()-interval '5 minutes'`, [maxAttempts]);
    const ready = await client.query<{ id: string }>(`
      SELECT id FROM outbox_jobs
      WHERE topic IN ('email.verify_email','email.recover_password')
        AND attempts < $1
        AND ((status IN ('pending','retry') AND available_at<=now()) OR (status='processing' AND locked_at<now()-interval '5 minutes'))
      ORDER BY available_at,created_at LIMIT 10
      FOR UPDATE SKIP LOCKED`, [maxAttempts]);
    const ids = ready.rows.map((row) => row.id);
    if (ids.length === 0) { await client.query('COMMIT'); return []; }
    const claimed = await client.query<EmailJob>(`UPDATE outbox_jobs SET status='processing',locked_at=now(),attempts=attempts+1
      WHERE id=ANY($1::uuid[]) RETURNING id,topic,payload,attempts`, [ids]);
    await client.query('COMMIT');
    return claimed.rows;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

function contentFor(job: EmailJob) {
  const verify = job.topic === 'email.verify_email';
  if (!verify && job.topic !== 'email.recover_password') throw new DeliveryError('unsupported_email_topic', false);
  const action = verify ? 'Verify email' : 'Reset password';
  const subject = verify ? 'Verify your Jfit email address' : 'Reset your Jfit password';
  const intro = verify ? 'Confirm this email address to finish setting up your Jfit account.' : 'We received a request to change the password for your Jfit account.';
  const note = verify ? 'If you did not create this account, you can ignore this email.' : 'If you did not request a password reset, you can ignore this email. Your password will not change.';
  const url = escapeHtml(job.payload.url);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head><body style="margin:0;background:#f6f5ef;color:#161912;font-family:Arial,sans-serif"><main style="max-width:560px;margin:32px auto;padding:32px;background:#fff"><p style="font-size:24px;font-weight:bold;margin:0 0 26px">jfit<span style="color:#98be35">•</span></p><h1 style="font-size:24px;line-height:1.25">${action}</h1><p style="font-size:16px;line-height:1.6">${intro}</p><p style="font-size:14px;line-height:1.5">This one-time link expires in ${job.payload.expiresIn}.</p><p style="margin:28px 0"><a href="${url}" style="display:inline-block;min-height:48px;padding:0 24px;line-height:48px;background:#161912;color:#fff;text-decoration:none;font-weight:bold">${action}</a></p><p style="font-size:14px;line-height:1.6;color:#66695f">${note}</p><p style="font-size:12px;color:#777a6f">Jfit · United Kingdom</p></main></body></html>`;
  const text = `${action}\n\n${intro}\n\nOpen this one-time link within ${job.payload.expiresIn}: ${job.payload.url}\n\n${note}\n\nJfit`;
  return { subject, html, text };
}

async function send(job: EmailJob): Promise<string> {
  const expiresAt = Date.parse(job.payload.expiresAt);
  if (!job.payload.to || !job.payload.url || !Number.isFinite(expiresAt)) throw new DeliveryError('invalid_email_job', false);
  if (Date.now() >= expiresAt) throw new DeliveryError('auth_link_expired', false);
  const content = contentFor(job);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `jfit-${job.id}` },
      body: JSON.stringify({ from, to: [job.payload.to], reply_to: process.env.EMAIL_REPLY_TO || undefined, subject: content.subject, html: content.html, text: content.text }),
    });
    const result: unknown = await response.json().catch(() => ({}));
    const data = result && typeof result === 'object' ? result as { id?: unknown; name?: unknown } : {};
    if (!response.ok) {
      const code = typeof data.name === 'string' ? data.name.slice(0, 60) : `provider_http_${response.status}`;
      const retryable = response.status === 429 || response.status >= 500 || code === 'concurrent_idempotent_requests';
      throw new DeliveryError(code, retryable);
    }
    if (typeof data.id !== 'string') throw new DeliveryError('provider_missing_message_id', true);
    return data.id;
  } catch (error) {
    if (error instanceof DeliveryError) throw error;
    throw new DeliveryError(error instanceof Error && error.name === 'AbortError' ? 'provider_timeout' : 'provider_network_error', true);
  } finally { clearTimeout(timeout); }
}

async function recordSuccess(job: EmailJob, providerId: string) {
  await pool.query(`UPDATE outbox_jobs SET status='completed',provider_message_id=$2,locked_at=NULL,completed_at=now(),last_error=NULL WHERE id=$1`, [job.id,providerId]);
}
async function recordFailure(job: EmailJob, error: DeliveryError) {
  const expired = Date.now() >= Date.parse(job.payload.expiresAt);
  const terminal = !error.retryable || job.attempts >= maxAttempts || expired;
  if (terminal) {
    await pool.query(`UPDATE outbox_jobs SET status='failed',locked_at=NULL,last_error=$2 WHERE id=$1`, [job.id,expired ? 'auth_link_expired' : error.code]);
    console.error(JSON.stringify({ event: 'email_delivery_failed', jobId: job.id, topic: job.topic, code: expired ? 'auth_link_expired' : error.code, attempts: job.attempts }));
    return;
  }
  const backoffMs = Math.min(5 * 60_000 * 2 ** (job.attempts - 1), 6 * 60 * 60_000) + randomInt(0, 10_000);
  if (Date.now() + backoffMs >= Date.parse(job.payload.expiresAt)) {
    await pool.query(`UPDATE outbox_jobs SET status='failed',locked_at=NULL,last_error='auth_link_expired' WHERE id=$1`, [job.id]);
    return;
  }
  await pool.query(`UPDATE outbox_jobs SET status='retry',available_at=now()+$2::interval,locked_at=NULL,last_error=$3 WHERE id=$1`, [job.id,`${backoffMs} milliseconds`,error.code]);
}

async function run() {
  console.info(JSON.stringify({ event: 'email_worker_started', provider: 'resend', pollMs }));
  while (!stopping) {
    const jobs = await claimBatch();
    if (jobs.length === 0) { await pause(pollMs); continue; }
    for (const job of jobs) {
      try { const providerId = await send(job); await recordSuccess(job,providerId); }
      catch (error) { await recordFailure(job,error instanceof DeliveryError ? error : new DeliveryError('worker_error',true)); }
    }
  }
}

function shutdown() { stopping = true; }
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);
run().catch((error: unknown) => {
  console.error(JSON.stringify({ event: 'email_worker_stopped', code: error instanceof Error ? error.name : 'unknown' }));
  process.exitCode = 1;
}).finally(() => void pool.end());
