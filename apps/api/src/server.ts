import argon2 from 'argon2';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Pool, type PoolClient } from 'pg';
import { hasStaffPermission, permissionsForRole, staffRoleForUser } from './authorization.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30_000 });
const port = Number(process.env.API_PORT ?? 4000);
const sessionTtlSeconds = 60 * 60 * 24 * 30;
const sessionCookie = 'jfit_session';
const appUrl = process.env.APP_URL ?? '';
const appOrigin = appUrl ? new URL(appUrl).origin : '';
const rateSecret = process.env.AUTH_RATE_LIMIT_SECRET ?? process.env.SESSION_SECRET ?? '';
const secureCookie = appOrigin.startsWith('https://');
const dummyPasswordHash = await argon2.hash(randomBytes(32), { type: argon2.argon2id });

type AuthenticatedUser = { id: string; sessionId: string; tokenHash: string; transport: 'cookie' | 'bearer' };
type RateBucket = 'login-ip' | 'login-email' | 'register-ip' | 'register-email' | 'recovery-ip' | 'recovery-email' | 'verify-ip' | 'reset-ip';

const json = (res: ServerResponse, status: number, data: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  res.end(JSON.stringify(data));
};
const apiError = (res: ServerResponse, status: number, code: string, message: string, requestId: string) => json(res, status, { error: { code, message, requestId } });

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const part of req) { raw += part; if (raw.length > 32_768) throw new Error('body_too_large'); }
  const value: unknown = JSON.parse(raw || '{}');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_body');
  return value as Record<string, unknown>;
}

function cookieValue(req: IncomingMessage, name: string): string {
  const cookies = req.headers.cookie?.split(';') ?? [];
  const entry = cookies.map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  try { return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''; }
  catch { return ''; }
}

function setSessionCookie(res: ServerResponse, token: string) {
  res.setHeader('Set-Cookie', `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionTtlSeconds}${secureCookie ? '; Secure' : ''}`);
}
function clearSessionCookie(res: ServerResponse) {
  res.setHeader('Set-Cookie', `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie ? '; Secure' : ''}`);
}

function requireBrowserOrigin(req: IncomingMessage, res: ServerResponse, requestId: string): boolean {
  if (req.headers['x-jfit-client'] === 'native') return true;
  if (appOrigin && req.headers.origin === appOrigin) return true;
  apiError(res, 403, 'origin_not_allowed', 'This origin is not allowed.', requestId);
  return false;
}

async function userFor(req: IncomingMessage): Promise<AuthenticatedUser | null> {
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
  const token = bearer || cookieValue(req, sessionCookie);
  if (token.length < 32 || token.length > 2048) return null;
  const digest = createHash('sha256').update(token).digest('hex');
  const result = await pool.query<{ id: string; user_id: string }>(
    `SELECT s.id,s.user_id FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()
        AND u.deleted_at IS NULL AND u.email_verified_at IS NOT NULL`, [digest],
  );
  const session = result.rows[0];
  return session ? { id: session.user_id, sessionId: session.id, tokenHash: digest, transport: bearer ? 'bearer' : 'cookie' } : null;
}

function canonicalEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}
function validPassword(input: unknown): input is string {
  return typeof input === 'string' && input.length >= 12 && input.length <= 128 && !/[\u0000-\u001f\u007f]/.test(input);
}
function validBirthDate(input: unknown): input is string {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  const date = new Date(`${input}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input) return false;
  const now = new Date();
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  if (now.getUTCMonth() < date.getUTCMonth() || (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate())) age--;
  return age >= 18 && age <= 120;
}
function rateKey(bucket: RateBucket, value: string): string {
  return createHmac('sha256', rateSecret).update(`${bucket}:${value}`).digest('hex');
}
function clientAddress(req: IncomingMessage): string {
  return req.socket.remoteAddress ?? 'unknown';
}

async function takeRateLimit(bucket: RateBucket, value: string, maximum: number): Promise<boolean> {
  if (rateSecret.length < 32) throw new Error('auth_rate_limit_secret_not_configured');
  const digest = rateKey(bucket, value);
  const result = await pool.query<{ attempts: number }>(`
    INSERT INTO auth_rate_limits(bucket_hash,window_started_at,attempts)
    VALUES($1,now(),1)
    ON CONFLICT(bucket_hash) DO UPDATE SET
      attempts=CASE WHEN auth_rate_limits.window_started_at < now()-interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts+1 END,
      window_started_at=CASE WHEN auth_rate_limits.window_started_at < now()-interval '15 minutes' THEN now() ELSE auth_rate_limits.window_started_at END,
      updated_at=now()
    RETURNING attempts`, [digest]);
  return Number(result.rows[0]?.attempts ?? maximum + 1) <= maximum;
}

async function authRate(req: IncomingMessage, kind: 'login' | 'register' | 'recovery' | 'verify' | 'reset', email?: string): Promise<boolean> {
  const ipLimits: Record<typeof kind, number> = { login: 20, register: 10, recovery: 10, verify: 30, reset: 10 };
  const ipOk = await takeRateLimit(`${kind}-ip`, clientAddress(req), ipLimits[kind]);
  if (!email) return ipOk;
  const emailLimits: Partial<Record<RateBucket, number>> = { 'login-email': 10, 'register-email': 5, 'recovery-email': 5 };
  const emailOk = await takeRateLimit(`${kind}-email` as RateBucket, email, emailLimits[`${kind}-email` as RateBucket] ?? 5);
  return ipOk && emailOk;
}

async function enqueueAuthEmail(client: PoolClient, userId: string, purpose: 'verify_email' | 'recover_password', email: string) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const lifetime = purpose === 'verify_email' ? '24 hours' : '1 hour';
  const lifetimeMs = purpose === 'verify_email' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const path = purpose === 'verify_email' ? '/account/verify' : '/account/reset-password';
  const link = new URL(path, appUrl).toString();
  const url = new URL(link);
  // Keep one-time secrets in the URL fragment; browsers do not send fragments in requests or referrers.
  url.hash = new URLSearchParams({ token }).toString();
  await client.query(`UPDATE auth_tokens SET consumed_at=now() WHERE user_id=$1 AND purpose=$2 AND consumed_at IS NULL`, [userId, purpose]);
  await client.query(`UPDATE outbox_jobs SET status='cancelled',last_error='superseded_auth_email' WHERE aggregate_id=$1 AND topic=$2 AND status IN ('pending','retry')`, [userId,`email.${purpose}`]);
  await client.query(`INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,now()+$4::interval)`, [tokenHash, userId, purpose, lifetime]);
  // Outbox content contains the one-time secret until the configured mail worker delivers it.
  await client.query(`INSERT INTO outbox_jobs(topic,aggregate_id,payload,status) VALUES($1,$2,$3::jsonb,'pending')`, [
    `email.${purpose}`, userId, JSON.stringify({ to: email, url: url.toString(), expiresIn: lifetime, expiresAt: new Date(Date.now()+lifetimeMs).toISOString() }),
  ]);
}

async function issueSession(client: PoolClient, userId: string, deviceLabel: unknown) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const label = typeof deviceLabel === 'string' ? deviceLabel.trim().slice(0, 100) : '';
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO sessions(user_id,token_hash,device_label,expires_at) VALUES($1,$2,$3,now()+interval '30 days') RETURNING id`,
    [userId, tokenHash, label || null],
  );
  return { token, sessionId: inserted.rows[0].id };
}

async function consumeToken(client: PoolClient, token: unknown, purpose: 'verify_email' | 'recover_password') {
  if (typeof token !== 'string' || token.length < 32 || token.length > 200) return null;
  const digest = createHash('sha256').update(token).digest('hex');
  const found = await client.query<{ user_id: string }>(
    `SELECT user_id FROM auth_tokens WHERE token_hash=$1 AND purpose=$2 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE`,
    [digest, purpose],
  );
  if (!found.rows[0]) return null;
  await client.query(`UPDATE auth_tokens SET consumed_at=now() WHERE token_hash=$1`, [digest]);
  return found.rows[0].user_id;
}

const server = createServer(async (req, res) => {
  const requestId = randomUUID();
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const origin = req.headers.origin;
    if (origin && origin === appOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      if (!origin || origin !== appOrigin) return apiError(res, 403, 'origin_not_allowed', 'This origin is not allowed.', requestId);
      res.writeHead(204, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Jfit-Client', 'Access-Control-Max-Age': '600', Vary: 'Origin' });
      return res.end();
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      try {
        await pool.query('SELECT 1');
        return json(res, 200, { service: 'jfit-api', status: 'ok', checks: { database: 'ok', email: process.env.RESEND_API_KEY && process.env.EMAIL_FROM ? 'configured_unverified' : 'not_configured', rateLimits: rateSecret.length >= 32 ? 'configured' : 'not_configured' }, requestId });
      }
      catch { return apiError(res, 503, 'database_unavailable', 'The API database is unavailable.', requestId); }
    }

    if (req.method === 'GET' && url.pathname === '/v1/products') {
      const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 20) || 20));
      const cursor = url.searchParams.get('cursor');
      const rows = await pool.query(`SELECT p.id,p.slug,p.name,p.category,v.id AS variant_id,v.sku,v.model,v.price_minor,v.currency
        FROM products p JOIN product_variants v ON v.product_id=p.id
        WHERE p.published AND v.published AND ($1::uuid IS NULL OR p.id>$1::uuid) ORDER BY p.id LIMIT $2`, [cursor,limit+1]);
      const hasMore = rows.rows.length > limit;
      const items = rows.rows.slice(0,limit);
      return json(res,200,{ items,nextCursor:hasMore ? items.at(-1)?.id : null,requestId });
    }

    if (req.method === 'POST' && ['/v1/auth/register','/v1/auth/login','/v1/auth/recover','/v1/auth/resend-verification','/v1/auth/verify-email','/v1/auth/reset-password'].includes(url.pathname)) {
      if (!requireBrowserOrigin(req, res, requestId)) return;
      const input = await body(req);
      if (url.pathname === '/v1/auth/register') {
        const email = canonicalEmail(input.email);
        const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';
        if (!email || !validPassword(input.password) || displayName.length < 1 || displayName.length > 80 || !validBirthDate(input.birthDate))
          return apiError(res, 400, 'invalid_request', 'Enter a valid email, a password of at least 12 characters, your name, and a date of birth showing you are 18 or older.', requestId);
        if (!await authRate(req, 'register', email)) return apiError(res, 429, 'rate_limited', 'Try again later.', requestId);
        if (!appOrigin || !process.env.DATABASE_URL) return apiError(res, 503, 'auth_unavailable', 'Account creation is not configured.', requestId);
        const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const created = await client.query<{ id: string; email_verified_at: Date | null }>(
            `INSERT INTO users(email,password_hash,display_name,birth_date) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING RETURNING id,email_verified_at`,
            [email, passwordHash, displayName, input.birthDate],
          );
          const user = created.rows[0];
          if (user && !user.email_verified_at) await enqueueAuthEmail(client,user.id,'verify_email',email);
          await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
        return json(res, 202, { message: 'If the address can be registered, verification instructions will be sent when email delivery is enabled.', requestId });
      }
      if (url.pathname === '/v1/auth/login') {
        const email = canonicalEmail(input.email);
        if (!email || typeof input.password !== 'string' || input.password.length > 128) return apiError(res, 400, 'invalid_request', 'Enter a valid email and password.', requestId);
        if (!await authRate(req, 'login', email)) return apiError(res, 429, 'rate_limited', 'Try again later.', requestId);
        const result = await pool.query<{ id: string; password_hash: string | null; email_verified_at: Date | null; deleted_at: Date | null }>(`SELECT id,password_hash,email_verified_at,deleted_at FROM users WHERE email=$1`, [email]);
        const user = result.rows[0];
        const hash = user?.password_hash ?? dummyPasswordHash;
        const passwordMatches = await argon2.verify(hash, input.password).catch(() => false);
        if (!user || !passwordMatches || !user.email_verified_at || user.deleted_at) return apiError(res, 401, 'invalid_credentials', 'Email or password is incorrect, or the account is not verified.', requestId);
        const client = await pool.connect();
        let session: { token: string; sessionId: string };
        try { await client.query('BEGIN'); session = await issueSession(client, user.id, input.deviceLabel); await client.query('COMMIT'); }
        catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
        if (req.headers['x-jfit-client'] === 'native') return json(res, 200, { accessToken: session.token, tokenType: 'Bearer', expiresIn: sessionTtlSeconds, sessionId: session.sessionId, requestId });
        setSessionCookie(res, session.token);
        return json(res, 200, { session: { id: session.sessionId, expiresIn: sessionTtlSeconds }, requestId });
      }
      if (url.pathname === '/v1/auth/recover') {
        const email = canonicalEmail(input.email);
        if (!email) return apiError(res, 400, 'invalid_request', 'Enter a valid email address.', requestId);
        if (!await authRate(req, 'recovery', email)) return apiError(res, 429, 'rate_limited', 'Try again later.', requestId);
        const result = await pool.query<{ id: string }>(`SELECT id FROM users WHERE email=$1 AND email_verified_at IS NOT NULL AND deleted_at IS NULL`, [email]);
        if (result.rows[0] && appOrigin) {
          const client = await pool.connect();
          try { await client.query('BEGIN'); await enqueueAuthEmail(client, result.rows[0].id, 'recover_password', email); await client.query('COMMIT'); }
          catch (error) { await client.query('ROLLBACK'); throw error; }
          finally { client.release(); }
        }
        return json(res, 202, { message: 'If an eligible account exists, recovery instructions will be sent when email delivery is enabled.', requestId });
      }
      if (url.pathname === '/v1/auth/resend-verification') {
        const email = canonicalEmail(input.email);
        if (!email) return apiError(res,400,'invalid_request','Enter a valid email address.',requestId);
        if (!await authRate(req,'recovery',email)) return apiError(res,429,'rate_limited','Try again later.',requestId);
        const result = await pool.query<{ id: string }>(`SELECT id FROM users WHERE email=$1 AND email_verified_at IS NULL AND deleted_at IS NULL`,[email]);
        if (result.rows[0] && appOrigin) {
          const client = await pool.connect();
          try { await client.query('BEGIN'); await enqueueAuthEmail(client,result.rows[0].id,'verify_email',email); await client.query('COMMIT'); }
          catch (error) { await client.query('ROLLBACK'); throw error; }
          finally { client.release(); }
        }
        return json(res,202,{ message:'If an unverified account exists, verification instructions will be sent when email delivery is enabled.',requestId });
      }
      if (url.pathname === '/v1/auth/verify-email') {
        if (!await authRate(req, 'verify')) return apiError(res, 429, 'rate_limited', 'Try again later.', requestId);
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const userId = await consumeToken(client, input.token, 'verify_email');
          if (!userId) { await client.query('ROLLBACK'); return apiError(res, 400, 'invalid_or_expired_token', 'This verification link is invalid or has expired.', requestId); }
          await client.query(`UPDATE users SET email_verified_at=COALESCE(email_verified_at,now()) WHERE id=$1`, [userId]);
          await client.query('COMMIT');
          return json(res, 200, { verified: true, requestId });
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
      }
      if (url.pathname === '/v1/auth/reset-password') {
        if (!validPassword(input.password)) return apiError(res, 400, 'invalid_request', 'Choose a password of at least 12 characters.', requestId);
        if (!await authRate(req, 'reset')) return apiError(res, 429, 'rate_limited', 'Try again later.', requestId);
        const hash = await argon2.hash(input.password, { type: argon2.argon2id });
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const userId = await consumeToken(client, input.token, 'recover_password');
          if (!userId) { await client.query('ROLLBACK'); return apiError(res, 400, 'invalid_or_expired_token', 'This recovery link is invalid or has expired.', requestId); }
          await client.query(`UPDATE users SET password_hash=$2 WHERE id=$1`, [userId, hash]);
          await client.query(`UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [userId]);
          await client.query('COMMIT');
          clearSessionCookie(res);
          return json(res, 200, { passwordReset: true, sessionsRevoked: true, requestId });
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
      }
    }

    const user = await userFor(req);
    if (!user) return apiError(res, 401, 'unauthenticated', 'Sign in to continue.', requestId);
    const isCookieMutation = user.transport === 'cookie' && ['POST','PATCH','PUT','DELETE'].includes(req.method ?? '');
    if (isCookieMutation && !requireBrowserOrigin(req, res, requestId)) return;

    if (req.method === 'GET' && url.pathname === '/v1/admin/me/permissions') {
      const role = await staffRoleForUser((sql, values) => pool.query<{ role: string }>(sql, values), user.id);
      if (!role || !hasStaffPermission(role, 'staff:read-self')) return apiError(res, 403, 'staff_access_required', 'This account does not have staff access.', requestId);
      return json(res, 200, { role, permissions: permissionsForRole(role), requestId });
    }

    if (req.method === 'POST' && url.pathname === '/v1/auth/logout') {
      await pool.query(`UPDATE sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL`, [user.sessionId, user.id]);
      if (user.transport === 'cookie') clearSessionCookie(res);
      return json(res, 200, { loggedOut: true, requestId });
    }
    if (req.method === 'POST' && url.pathname === '/v1/auth/logout-all') {
      await pool.query(`UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [user.id]);
      if (user.transport === 'cookie') clearSessionCookie(res);
      return json(res, 200, { sessionsRevoked: true, requestId });
    }
    if (req.method === 'GET' && url.pathname === '/v1/sessions') {
      const result = await pool.query(`SELECT id,device_label,created_at,expires_at,(id=$2) AS current FROM sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC`, [user.id,user.sessionId]);
      return json(res, 200, { items: result.rows, requestId });
    }
    const sessionMatch = url.pathname.match(/^\/v1\/sessions\/([0-9a-f-]{36})$/i);
    if (req.method === 'DELETE' && sessionMatch) {
      const result = await pool.query(`UPDATE sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id`, [sessionMatch[1],user.id]);
      if (sessionMatch[1] === user.sessionId && user.transport === 'cookie') clearSessionCookie(res);
      return json(res, 200, { revoked: result.rowCount === 1, requestId });
    }
    if (req.method === 'GET' && url.pathname === '/v1/me') {
      const result = await pool.query(`SELECT id,email,email_verified_at,display_name,birth_date,country_code,created_at FROM users WHERE id=$1 AND deleted_at IS NULL`, [user.id]);
      return result.rows[0] ? json(res, 200, { user: result.rows[0], requestId }) : apiError(res, 404, 'not_found', 'Account not found.', requestId);
    }
    if (req.method === 'PATCH' && url.pathname === '/v1/me') {
      const input = await body(req);
      if (typeof input.displayName !== 'string' || input.displayName.trim().length < 1 || input.displayName.trim().length > 80) return apiError(res, 400, 'invalid_request', 'Enter a name between 1 and 80 characters.', requestId);
      const result = await pool.query(`UPDATE users SET display_name=$2 WHERE id=$1 AND deleted_at IS NULL RETURNING id,email,email_verified_at,display_name,birth_date,country_code`, [user.id,input.displayName.trim()]);
      return result.rows[0] ? json(res, 200, { user: result.rows[0], requestId }) : apiError(res, 404, 'not_found', 'Account not found.', requestId);
    }
    if (req.method === 'GET' && url.pathname === '/v1/completions') {
      const result = await pool.query(`SELECT id,workout_id,operation_id,completed_at,metrics FROM completions WHERE user_id=$1 ORDER BY completed_at DESC LIMIT 100`, [user.id]);
      return json(res, 200, { items: result.rows, nextCursor: null, requestId });
    }
    if (req.method === 'POST' && url.pathname === '/v1/completions') {
      const input = await body(req);
      if (typeof input.operationId !== 'string' || input.operationId.length < 8 || input.operationId.length > 120 || typeof input.workoutId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.workoutId) || typeof input.completedAt !== 'string' || !Number.isFinite(Date.parse(input.completedAt)))
        return apiError(res, 400, 'invalid_request', 'Provide a valid operationId, workoutId and completedAt.', requestId);
      const result = await pool.query(`INSERT INTO completions(user_id,workout_id,operation_id,completed_at,metrics)
        SELECT $1,$2,$3,$4::timestamptz,'{}'::jsonb WHERE EXISTS (SELECT 1 FROM workouts WHERE id=$2 AND published)
        ON CONFLICT(user_id,operation_id) DO UPDATE SET operation_id=EXCLUDED.operation_id
        RETURNING id,workout_id,operation_id,completed_at,metrics`, [user.id,input.workoutId,input.operationId,input.completedAt]);
      if (!result.rows[0]) return apiError(res, 404, 'workout_unavailable', 'That workout is not available.', requestId);
      return json(res, 200, { completion: result.rows[0], requestId });
    }
    return apiError(res, 404, 'not_found', 'No API resource matches this request.', requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'body_too_large' || message === 'invalid_body' || error instanceof SyntaxError) return apiError(res, 400, 'invalid_request', 'Request body must be a small JSON object.', requestId);
    if (message === 'auth_rate_limit_secret_not_configured') return apiError(res, 503, 'auth_unavailable', 'Account security services are not configured.', requestId);
    console.error(JSON.stringify({ event: 'api_request_failed', requestId, method: req.method, path: req.url }));
    return apiError(res, 500, 'internal_error', 'The request could not be completed.', requestId);
  }
});

server.listen(port, () => console.info(JSON.stringify({ event: 'api_started', port })));
process.on('SIGTERM', () => { server.close(); void pool.end(); });
