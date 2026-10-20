# Repository audit

Audit baseline: `origin/main` at `7ffd5087a231a608c74c082f38545e2f0aa234d9` (19 October 2026). The repair branch is based on this revision. This is a source review, not a production security or legal review.

## Repository shape

- `apps/web`: Next.js App Router public pages and account portal. Routes are primarily presentation shells; account and health pages call the API.
- `apps/mobile`: Expo / React Native application shell, account UI and SecureStore helper.
- `apps/api`: Node HTTP API, PostgreSQL access, initial migration, and permission mapping.
- `apps/worker`: polling PostgreSQL outbox worker with Resend delivery adapter.
- `packages/contracts`: small shared TypeScript DTO and plan definitions.
- `scripts`: one-shot SQL migration and opt-in development fixture scripts.
- `.github/workflows/generator-generic-ossf-slsa3-publish.yml`: unmodified SLSA sample; it creates placeholder text files and is not CI for Jfit.

## Runtime and reproducibility

Root requires Node `>=20.9`; package manifests pin Next.js `16.4.1`, React `19.2.0`, Expo `58.0.0`, React Native `0.83.0`, TypeScript `5.9.3`, `pg` `8.16.3`, and `argon2` `0.44.0`. No `package-lock.json` is tracked, so resolved transitive dependencies and installs are not reproducible. Existing ignored `node_modules` directories are not evidence of a clean install. No runtime version file or CI quality workflow exists.

The migration is one initial SQL transaction, but `scripts/migrate.mjs` does not track migration versions. The API and worker depend on `DATABASE_URL`; the live Vercel API currently returns `database_unavailable`, and the Vercel project has no environment variables.

## Functional baseline

- API: health, published product/variant listing, customer account lifecycle, active sessions, own profile, own completion writes, and a self-only staff permission endpoint.
- Web: public route shells, membership display, account lifecycle and session controls.
- Mobile: tab shell and basic login/register/recovery UI; offline operation helper is not connected to an API sync queue.
- Worker: email verification/recovery delivery with leasing, idempotency and retry logic; provider and sender configuration are external.
- Commerce, memberships, administration, video playback, and most training flows have schemas or route placeholders only. See `feature-matrix.md`.

## Phase 1 findings

1. Product paging orders/cursors only on `products.id` despite returning joined variants. A multi-variant product can be split across a page boundary and skipped by the next product-only cursor. Cursor syntax and limit values are not validated.
2. `X-Jfit-Client: native` is treated as proof of native transport and changes the login response to a bearer token. It is client-controlled. Browser CSRF checks otherwise compare the exact configured origin for cookie mutations.
3. Completion operation IDs are weakly validated, repeated writes update as a no-op without checking conflicting payloads, and completion timestamps accept any JavaScript-parseable string. The mobile helper currently emits non-UUID IDs.
4. Web session revoke/logout-all buttons ignore HTTP responses and network errors, then clear local signed-in state as though revocation succeeded. Session refresh silently treats a failed session request as an empty list.
5. Mobile logout ignores non-2xx/API failure and always claims success. SecureStore errors can interrupt the flow; expired sessions and session-list/device controls are not handled. Visible cards outside Today reselect the active tab instead of navigating or clearly disabling unavailable features.
6. The workflow is the SLSA generator example, emits placeholder artifacts, and performs no install, build, tests, audit, or secret scan.

## External validation limits

There is no tracked lockfile, configured CI, configured Vercel database/secrets, or declared isolated PostgreSQL test URL at audit time. Consequently dependency advisory coverage, clean install reproducibility, database-backed integration checks, native platform builds, and production data behaviour require separate evidence. No provider credentials or licensed content were found in tracked configuration; this review did not inspect ignored secret files.
