# Jfit architecture and assumptions

## Product decisions

- Jfit is an independent UK fitness and equipment business concept. Public reference pages inform the broad product experience only; the Jfit catalogue, media, branding and trainers are independent.
- British English, GBP, UK market, UTC persisted timestamps and Europe/London business schedules.
- Monorepo boundaries: `apps/web` (Next.js App Router web and administration shell), `apps/mobile` (native React Native/Expo source), `apps/api` (versioned PostgreSQL migrations and API boundary), and `packages/contracts` (shared DTOs and plan rules).
- Next.js App Router is the current documented web framework. Node.js 20.9 or later is required. Expo SDK 58 is the currently documented starter generation; native build setup and registry resolution are external to this offline workspace.
- PostgreSQL is the source of truth. Financial values use integer minor units and immutable order item snapshots. All provider callbacks require signature verification, idempotency and reconciliation before entitlements or inventory can be considered live.
- Stripe Checkout/Billing, Mux, email and push are replaceable adapters. The account API writes verification/recovery messages to a durable outbox; a Resend-compatible worker sends them with idempotency keys and retry/backoff when configured. No provider credentials or verified sender domain are present. Checkout and playback are not enabled.
- Real customer operation is blocked pending operator identity/contact data, verified tax configuration, supplier/inventory, fulfilment/returns policy, licensed media, service credentials, security review and deployment configuration.

## Trust boundaries

Native/web clients are untrusted. The server must derive user identity and membership from verified sessions, authorize every object access, calculate totals, reserve stock inside transactions and issue short-lived media credentials only after checking entitlements. Staff role grants are provisioned through a controlled offline process and audited. Provider secrets remain server-side.

## Financial and concurrency invariants

- A cart is not a price promise; checkout re-reads current prices and returns a confirmation preview.
- Inventory reservation, order snapshot and payment intent are one idempotent workflow. Late payment after reservation expiry enters reconciliation/refund/stock-recovery handling; it must not silently consume unreserved stock.
- Provider event IDs are unique per provider and must be stored before effects; event processing is transactional/outbox-backed in production.
- Pro capacity counts accepted seats and active unexpired invitations in a serializable transaction; limit is five including owner. Invitation tokens are hashed, single-use and expiring.
- Completion `operation_id` is unique per user to make offline retries idempotent.

## Mobile purchase distribution

Web subscriptions use Stripe only when configured. Native digital membership purchase requires StoreKit / Google Play Billing and server-side receipt or signed transaction verification. The mobile shell does not embed web checkout and currently cannot buy or restore a subscription. Apple distinguishes digital subscriptions from physical equipment purchases; storefront-specific policy and current agreement must be reviewed before release.

## Identity implementation boundary

The API uses Argon2id password hashes, random 256-bit sessions stored by SHA-256 digest, HttpOnly/SameSite web cookies, Expo SecureStore-backed native bearer credentials and HMAC-hashed 15-minute database rate-limit buckets. Verification/reset tokens are random, hashed, single-use and expire after 24 hours / one hour. Email outbox payloads contain one-time links until a trusted worker delivers them; database access and backups must be restricted. Tokens are in URL fragments so the browser does not send them to the web server. Browser authentication calls require the configured origin. PostgreSQL migrations, `APP_URL`, and a 32-character `AUTH_RATE_LIMIT_SECRET` (or `SESSION_SECRET`) must be configured. These flows have not been security reviewed or integration tested.

## Runtime and reproducibility

Copy `.env.example` to `.env.local`, install workspace dependencies with `npm install` on a network-enabled machine, run `npm run db:up`, apply the SQL migration with `npm run db:migrate`, and start the web app with `npm run dev`. Registry access failed in the implementation environment, so this checkout has no generated lockfile and these commands have not been verified here. Pin and review resolved lockfile versions in a connected build environment before deployment.

## Current official implementation references

- [Next.js App Router installation](https://nextjs.org/docs/app/getting-started/installation) documents Node.js 20.9 or later and the App Router setup used here.
- [Expo project creation](https://docs.expo.dev/get-started/create-a-project/) currently documents SDK 58 as the default generation; use Expo's environment setup before native builds.
- [Apple App Review Guidelines (UK)](https://developer.apple.com/app-store/review/guidelines/uk/) require in-app purchase for digital features/subscriptions in the default case; check storefront entitlements before release.
- [Google Play Billing backend integration](https://developer.android.com/google/play/billing/backend) calls for server-side purchase lifecycle and RTDN reconciliation.
- [Mux secure playback](https://www.mux.com/docs/guides/secure-video-playback) requires signed playback tokens to be issued from a protected server for member-only content.
- [PostgreSQL transactions](https://www.postgresql.org/docs/17/transactions.html) are the basis for the planned reservation, seat and payment invariants.
