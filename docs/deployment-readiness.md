# Deployment readiness

## Current deployment

- Web: `https://jfit.vercel.app/` is deployed and the homepage rendered during the deployment review.
- API: Vercel Services routes `/api/*` to the API container and other paths to Next.js. The container starts correctly, but `GET /api/health` returns HTTP 503 `database_unavailable`.
- Vercel project variables: none configured at audit time. Production customer account flows therefore remain unavailable.
- Worker, database, email, payment and media provider are not deployed/configured.

## Required before staging acceptance

1. Provision an isolated managed PostgreSQL instance and set `DATABASE_URL` with TLS and restricted privileges.
2. Apply a tracked migration workflow and verify backup/restore.
3. Set independent random `SESSION_SECRET` and `AUTH_RATE_LIMIT_SECRET` values (at least 32 bytes), `APP_URL`, and the correct web API base. Never place server secrets in `NEXT_PUBLIC_` or `EXPO_PUBLIC_` variables.
4. Configure request/error monitoring, structured log retention, alerts and rollback procedures.
5. Deploy the email worker only after `RESEND_API_KEY`, verified `EMAIL_FROM`, provider delivery monitoring and retry/dead-letter operations are ready.
6. Validate production and preview environment separation; do not enable Stripe/Mux or public premium features until their dedicated acceptance and operator prerequisites are satisfied.

## Release status

Not ready for customer accounts, commerce, memberships, email delivery, or premium workouts. No staging acceptance run, native build, migration restore drill, or rollback drill has been recorded. Production rollout and payment activation require explicit authorisation after the reviewable implementation and staging evidence are available.
