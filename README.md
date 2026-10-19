# Jfit

Independent UK fitness platform starter with responsive Next.js web experience, native iOS/Android source, shared contracts and PostgreSQL foundation.

## Local development

Requirements: Node.js 20.9+, npm, Docker, PostgreSQL client (`psql`), and for native builds Xcode (iOS/macOS) or Android Studio/JDK (Android).

1. Copy `.env.example` to `.env.local`; replace both security secrets before any non-local use. Set `EXPO_PUBLIC_API_URL` to an address reachable by the device/simulator (Android emulator commonly uses `http://10.0.2.2:4000`).
2. Run `npm install` to resolve workspace packages and generate the lockfile.
3. `npm run db:up` starts local PostgreSQL; `npm run db:migrate` loads `DATABASE_URL` from `.env.local` and applies the initial schema.
4. `npm run dev:api` starts the API on port 4000; `npm run dev` starts the Next.js web experience on port 3000. The API loads `../../.env.local` from its workspace directory.
5. To send queued account emails, configure `RESEND_API_KEY`, `EMAIL_FROM` and optionally `EMAIL_REPLY_TO`, then run `npm run dev:worker`. Verify the sender domain's required DNS records in Resend before sending real mail.
6. `npm run typecheck` checks all packages with configured typecheck scripts.
7. For native development, run `npm run start -w @jfit/mobile`; use `npm run ios -w @jfit/mobile` or `npm run android -w @jfit/mobile` for development builds.

Development fixtures are opt-in. Set `FIXTURES_ENABLED=true` in the shell before `npm run db:seed:dev`; sample products, trainers and workouts are marked unpublished and are never live inventory/content. The seed script loads `DATABASE_URL` from `.env.local` and refuses unless the opt-in is true.

Auth uses Argon2id and PostgreSQL-backed rate limits. Verification and recovery messages are sent by the separate worker when `RESEND_API_KEY` and a verified-domain `EMAIL_FROM` are configured; run it with `npm run dev:worker`. Without those credentials the worker exits without touching queued messages. An isolated copy passed the API typecheck, two staff-permission tests and a Next.js production build. Full workspace installation on the mounted volume failed during npm package renames, so the root lockfile, database migration, native builds and end-to-end checks remain outstanding. Provider credentials, a verified email sender domain, commercial policy, operator details, catalogue/media rights, payment configuration and app store setup remain required.

See [architecture](docs/architecture.md), [requirements/status](docs/requirements.md), [permissions](docs/permissions.md), [entitlements](docs/entitlements.md), [API contract](docs/api.md), and [email delivery setup](docs/email-delivery.md).
