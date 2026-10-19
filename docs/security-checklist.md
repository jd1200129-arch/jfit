# Security checklist

## Implemented source controls (not independently security-reviewed)

- Argon2id password hashes, random session tokens stored by digest, HttpOnly/SameSite cookies, Secure on HTTPS, short-lived hashed one-time tokens, generic account-recovery responses, and database-backed rate-limit buckets.
- Parameterised SQL, user-scoped profile/session/completion lookups, a deny-by-default staff role map, and a worker outbox with sanitized error codes.
- Unpublished development fixtures require explicit opt-in. Payment, AI, hardware and live media capabilities remain disabled/unconfigured.

## Phase 1 review items

- Do not treat `X-Jfit-Client` or any other client-provided header as application identity. Select cookie response only for same-origin browser requests; native uses explicit bearer-token transport and is still an untrusted client.
- Require exact configured origin for browser cookie mutations; reject mismatched `Origin`; do not emit permissive credentialed CORS headers.
- Validate product cursors/limits and completion UUID/timestamp/payload; make duplicate operation IDs return the stored result only when the full immutable write matches.
- Keep UI state consistent with confirmed server revocation; preserve a retry path when a native client is offline.

## Release blockers

- The 2026-10-19 lockfile audit reports 21 high and 12 moderate advisories in Expo/React Native transitive dependencies. `npm audit fix` cannot resolve them without major framework changes (the suggested Expo downgrade is to 44.0.6). Keep this as a release blocker and plan a compatible Expo/React Native upgrade with a native build and regression review; do not force the downgrade.
- Provision/rotate independent `SESSION_SECRET` and `AUTH_RATE_LIMIT_SECRET` values; configure TLS-protected PostgreSQL, backups and least-privilege DB credentials.
- Add tests for object-level authorisation, session fixation/rotation, CSRF, abuse limits, webhook signature/idempotency, and secret-safe logs.
- Keep lockfile-backed dependency advisory review and secret scanning in release review; add content security policy/security headers review and independent application security review.
- Configure verified mail provider only when sender ownership and delivery operations are ready. Do not activate payments, premium playback, health data or equipment commands without provider/security/safety acceptance.
- Review UK privacy, retention, consumer and age policies with qualified operators; this checklist is not a compliance certification.
