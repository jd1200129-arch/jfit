# Account email delivery setup

The worker sends only account verification and password recovery messages. It does not send marketing email.

## Configure the provider

1. Create a Resend account and add a domain/subdomain controlled by the Jfit operator.
2. Add the exact DNS records shown by Resend for domain ownership and sending authentication. Verify the provider reports the sender as ready before using the address. Configure a DMARC policy with the domain owner; do not copy example SPF/DKIM values from this repository because the provider gives domain-specific records.
3. Set `RESEND_API_KEY`, `EMAIL_FROM` to a monitored sender address, and optionally `EMAIL_REPLY_TO` in the API/worker server environment only. Never prefix these variables with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.
4. Run the API and `npm run dev:worker`. The worker claims jobs with PostgreSQL `FOR UPDATE SKIP LOCKED`, sends with an idempotency key per job, retries transient failures with jittered exponential backoff, and fails jobs when their one-time token expires.
5. Check `outbox_jobs.status`, `attempts`, `provider_message_id` and sanitized `last_error` operationally. Never log or export the outbox payload: it contains the recipient and one-time URL fragment.

The account API may accept a registration/recovery request while email delivery is not configured; it uses generic responses to avoid revealing whether an address has an account. Messages remain queued until the worker and sender are configured. A successful provider API response confirms acceptance by the provider, not final inbox delivery. Delivery/bounce/complaint webhooks and suppression handling are not implemented yet, so production email health still needs provider-side monitoring.

Resend supports idempotency keys for email requests; Jfit uses a stable key based on the outbox job ID to reduce duplicate messages during retries. [Resend idempotency guidance](https://resend.com/changelog/idempotency-keys). Configure the actual sender's DNS records in Resend and validate SPF, DKIM and DMARC before real delivery.
