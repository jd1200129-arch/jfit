# Permission and privacy matrix

Every API request must be authenticated where noted and authorize the requested resource on the server. A hidden control in the UI is not authorization. The identity API enforces own-user scopes for profile, sessions and training completions. `apps/api/src/authorization.ts` defines deny-by-default staff permissions from the database-assigned role; `GET /v1/admin/me/permissions` reports only the caller's own role. No staff role-grant or resource-management endpoint is exposed yet.

| Role | Own profile/training | Billing | Commerce | Content | Support | Financial actions | Roles/settings |
|---|---|---|---|---|---|---|---|
| Visitor | Public catalogue only | None | Own anonymous cart only | Published content | Public help | None | None |
| Customer | Own only | Own only | Own cart/orders/returns | Published content permitted by entitlement | Own cases | None | None |
| Pro invited member | Own only | None | Own orders only | Owner's current entitlement, own progress only | Own cases | None | None |
| Trainer | Own profile and assigned content drafts | None | None | Assigned sessions only | Assigned moderation if granted | None | None |
| Content manager | Own data | None | None | Create/edit/publish content | None | None | No role grants |
| Commerce/fulfilment | Own data | None | Orders, dispatch, stock, return processing | Read-only catalogue | Order-linked cases | Refund requests only within explicit policy; no payment configuration | No role grants |
| Support | Own data | None | Minimal order status needed for case | None | Assigned cases | No refunds or payout access | No role grants |
| Finance | Own data | Reconciliation metadata | Read-only orders/refunds | None | None | Reconcile/refund within approved limits | No role grants |
| Administrator | Only as operationally required and audited | No credential/card access | Configurable | Configurable | Configurable | High-risk actions require re-authentication and audit | Grant staff roles through controlled process |

All staff access is denied by default. Permission checks use server-side role assignments; clients cannot submit or change a role. Trainers have assigned-content permissions only, support can access assigned cases and limited order status, finance can review refunds but cannot request them, and commerce can request but not review refunds. Staff role grants still require explicit approval and an audited offline process; scoped assignment to individual resources, step-up authentication for high-risk actions, and audit-backed management endpoints remain unimplemented. Invited Pro members are separate identities and never inherit owner billing access. Subscription membership controls training entitlement only; each user's goals, schedule and history remain private. API queries must scope private rows by authenticated user id; owner access to other members' progress is not implied.

Authentication currently uses Argon2id password hashes, generic account/recovery responses, single-use SHA-256 hashed tokens, a durable email outbox, a Resend-compatible worker with idempotency keys and retry/backoff, 15-minute hashed database-backed rate-limit buckets, random 256-bit sessions and secure HttpOnly/SameSite browser cookies (Secure on HTTPS). Browser mutations require a same-origin check; native bearer sessions are stored using Expo SecureStore. Password recovery revokes all sessions. Provider credentials, sender-domain verification, end-to-end verification, age assurance, security review, staff provisioning, resource-scoped authorization and deployment rate-limit tuning remain outstanding. Never return a raw session token from logs or analytics.
