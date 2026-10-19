# API contract

The Node API listens on port 4000 by default. JSON requests and responses; ISO-8601 UTC timestamps. Error envelope: `{"error":{"code":"...","message":"...","requestId":"..."}}`. Collection responses use `{items, nextCursor}`. Money is `{amountMinor,currency,taxMinor}`. Financial/provider mutations will require idempotency keys; progress writes require client `operationId`. Authenticate and authorize every object request using the policy in `permissions.md`.

| Method / path | Access | Purpose |
|---|---|---|
| GET `/health` | Public diagnostic | API database connectivity check. |
| POST `/v1/auth/register` | Public, origin-checked and throttled | Validate adult date-of-birth assertion, hash password, queue verification message with generic response. |
| POST `/v1/auth/login` | Public, origin-checked and throttled | Verify email/password; issue web cookie or native bearer token. |
| POST `/v1/auth/recover`, `/v1/auth/resend-verification` | Public, origin-checked and throttled | Generic response and queued one-time email if eligible. |
| POST `/v1/auth/verify-email`, `/v1/auth/reset-password` | Public, origin-checked and throttled | Consume short-lived single-use token; reset revokes sessions. |
| POST `/v1/auth/logout`, `/v1/auth/logout-all` | Authenticated | Revoke current or all sessions. |
| GET `/v1/sessions`, DELETE `/v1/sessions/{id}` | Authenticated | List own active device sessions or revoke one. |
| GET `/v1/products` | Public | Published product/variant listing with cursor and limit. |
| GET `/v1/admin/me/permissions` | Authenticated staff | Return the caller's database-assigned staff role and permission set; non-staff receive 403. |
| GET/PATCH `/v1/me` | Authenticated | Read or update own profile. |
| GET/POST `/v1/completions` | Authenticated | Own progress; writes are idempotent on `(user,operationId)`. |

## Planned routes

The following routes are contract targets only; they are not implemented yet.

| GET `/catalog/products` and `/workouts` | Public | Search, category/activity filters, cursor pagination. |
| GET `/products/{id}`, `/workouts/{id}` | Public/entitlement-aware | Details; protected playback uses separate endpoint. |
| POST/GET `/cart`, `/cart/items` | Customer or signed anonymous cart | Cart operations; checkout always recalculates current prices. |
| POST `/checkout/preview`, `/checkout/orders` | Customer | Validate postcode/shipping configuration, reserve stock and begin provider payment. |
| POST `/webhooks/stripe` | Provider signature | Verify signature, deduplicate event and reconcile orders/subscriptions. |
| GET/POST `/subscriptions`, `/invitations` | Owner | Billing management and bounded seat invitations. |
| POST `/media/{id}/playback` | Entitled member | Server-side entitlement check, issue expiring playback token. |
| POST `/progress/completions` | Customer | Idempotent offline-safe completion writes. |
| `/admin/*` | Authorized staff role | Scoped product/content/order/support operations with audit. |

`apps/worker` implements Resend sends with idempotency, expiry checks and retry/backoff. Provider credentials, verified sender domain and successful delivery are unconfigured/unverified. Staff RBAC, broad resource middleware, checkout, payment webhook and subscription operations remain unimplemented. The web `GET /api/health` reports missing/configured-unverified integrations.
