# Jfit requirements and delivery status

Statuses mean: **Implemented** source exists; **Verified** behaviour has evidence from an executed check; **Awaiting configuration** code boundary/UI exists but real services or operator data are missing; **Dependent on external access** requires credentials, devices, rights or partner access; **Outside baseline** is explicitly optional. No capability is production-ready solely because a screen or schema exists.

| Area | Status | Notes |
|---|---|---|
| UK product scope, branding, GBP plan configuration | Implemented | Independent Jfit presentation; seed prices in shared contract and migration; purchase inactive. |
| Responsive public experience and navigation | Implemented | Home plus Shop, Workouts, Programmes, Trainers, Membership, About, Help, Account and Admin routes. |
| Architecture and staged assumptions | Implemented | See architecture, permissions, entitlements and API docs. |
| PostgreSQL initial data model and constraints | Implemented | Initial migration covers identities, sessions/tokens, staff, plans/subscriptions/seats, products/carts/orders/payments, workouts/programmes/progress and operational basics; coverage gaps are called out below. |
| Database migration execution | Awaiting configuration | PostgreSQL service/client not available in this environment. |
| Shared API, public products, own profile and progress endpoints | Implemented | PostgreSQL-backed API; completion writes deduplicate by user and operation ID. |
| Registration, login, verification/reset/resend requests | Implemented | Argon2id, adult DOB gate, generic responses, hashed one-use tokens, durable email outbox and Resend-compatible retrying worker. Provider credentials/sender-domain verification are awaiting configuration. |
| Session and device management | Implemented | HTTP-only web cookie, native bearer token stored via SecureStore, list/revoke/logout-all. No app/browser test run. |
| API auth and staff permission mapping | Implemented | Own-profile/session/completion queries are user-scoped; staff permissions are server-mapped and `GET /v1/admin/me/permissions` is self-scoped. Resource-specific admin handlers, role provisioning, audit enforcement and step-up checks remain unimplemented. |
| Product fixtures and customer fixtures | Awaiting configuration | Opt-in unpublished product, trainer and workout fixtures exist; test customer account fixture is not included. |
| Equipment catalogue/search/filters/compare/detail | Awaiting configuration | Route states and product schema exist; no real inventory/content. |
| Cart, checkout, stock reservation, fulfilment, returns | Awaiting configuration | Schema baseline only; transactional service and UI operations remain. |
| Web payment and subscription lifecycle | Awaiting configuration | Stripe adapter not wired; plans marked inactive. |
| Entitlements, Pro invitations and privacy isolation | Awaiting configuration | Schema/limits documented; transactional endpoints remain. |
| Trainer/workout/programme authoring and discovery | Awaiting configuration | Tables and route shell exist; authored catalogue unavailable. |
| Protected video playback/captions/resume | Dependent on external access | Mux credentials, owned media and signed-playback service required. |
| Schedule, reminders, favourites, progress, challenges | Awaiting configuration | Completion schema has idempotency; user flows and sync endpoint remain. |
| Admin roles and operational console | Awaiting configuration | Admin route explains disabled state; audited admin backend is absent. |
| Native iOS and Android source | Implemented | React Native/Expo shell, bottom tabs, registration/login/recovery UI, secure storage helper and offline operation ID helper. Native build not executed; email verification link opens web. |
| Native store purchase/restore and verification | Dependent on external access | Store accounts, product setup, billing SDK integration and signed server verification needed. |
| AI, routes, health/fitness providers, telemetry | Dependent on external access | Capability flags default disabled; provider adapters and consent flows remain. |
| Hardware controls and equipment-screen delivery | Dependent on external access | Disabled until verified device contract and safety controls exist. |
| Live classes/private sessions | Outside baseline | Roadmap-only; disabled by default. |
| Health-data/age controls for minors | Awaiting configuration | Registration requires self-declared age 18+; no 16–17-year-old onboarding is exposed. Age assurance and guardian flow required before enabling minors. |
| Legal policies, customer contacts, tax, shipping, warranty | Awaiting configuration | Must be supplied/verified by operator; never inferred from references. |
| Automated acceptance / CI / visual QA | Awaiting configuration | The API typecheck and two pure staff-permission tests passed in an isolated copy. Workspace lockfile, database-backed authorization, end-to-end checks and visual QA remain outstanding. |

## Remaining gaps in data model

Dedicated shipment/tracking events, return/refund request workflows, moderated reviews, notification templates/delivery attempts, durable job/outbox records, media upload/transcode processing and export/deletion retention records need follow-on migrations. Payment events have an idempotency ledger foundation but no worker. Account deletion needs explicit legal retention rules.

## Age policy assumption

Launch assumption is an adult-only account flow until guardian consent, supervised 16–17 access restrictions, age verification/assurance and adult-only AI gates are designed and reviewed. Do not accept under-18 registrations in an operating release before that work exists.
