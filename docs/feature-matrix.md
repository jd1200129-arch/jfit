# Feature matrix

Status labels follow the master implementation prompt. “Verified” requires an executed check recorded in the audit/test evidence; source presence alone is not verification.

| Feature                                                    | Status                            | Evidence / remaining work                                                                                      |
| ---------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Jfit UK brand, GBP plans and public home/navigation        | Implemented but unverified        | Web source and shared plan values exist; no accessibility/route interaction suite.                             |
| Public product, workout, programme and trainer pages       | Partially implemented             | Route shells and unpublished fixtures exist; no production catalogue or content authoring.                     |
| PostgreSQL initial schema                                  | Implemented but unverified        | `apps/api/migrations/0001_initial.sql`; migration not applied in a controlled test database here.              |
| Migration runner and seed guard                            | Implemented but unverified        | `scripts/migrate.mjs`, `scripts/seed-dev.mjs`; migration version ledger is absent.                             |
| API health                                                 | Implemented but unverified        | `GET /health`; live deployment reports database unavailable because Vercel has no variables/DB.                |
| Product listing and pagination                             | Partially implemented             | API query exists; ordering/cursor defect is in Phase 1 scope.                                                  |
| Adult account registration/login/recovery                  | Partially implemented             | Argon2id, token tables and outbox exist; provider config and end-to-end DB tests are absent.                   |
| Web session list/revocation                                | Partially implemented             | API routes/UI exist; web UI does not currently verify revoke outcomes.                                         |
| Native secure credential storage                           | Implemented but unverified        | Expo SecureStore helper exists; platform build and lifecycle tests are absent.                                 |
| Workout completion writes                                  | Partially implemented             | API has unique `(user_id,operation_id)`; validation/conflict handling and sync client need repair.             |
| Staff role permission map                                  | Implemented but unverified        | Deny-by-default role mapping and two tests exist; object-level admin operations/provisioning are absent.       |
| Email verification/recovery delivery                       | Blocked by external dependency    | Worker exists; Resend credentials, verified sender domain, worker hosting and delivery monitoring are absent.  |
| Product cart, checkout, stock, fulfilment, refunds         | Not implemented                   | Schema foundations only; no transactional service/UI or sandbox journey.                                       |
| Membership purchase, entitlements, family seats            | Not implemented                   | Proposed rules are documented; billing and seat endpoints are absent.                                          |
| Protected workout/video delivery                           | Blocked by external dependency    | Requires licensed media, provider setup, signed playback and entitlement enforcement.                          |
| Mobile Today/Explore/Plan/Progress/Profile                 | Partially implemented             | Shell renders; cards are not fully navigable, progress sync is not connected.                                  |
| Administration and trainer operations                      | Not implemented                   | Routes/docs exist; operational endpoints and audited workflows do not.                                         |
| AI, health integrations, connected equipment, live classes | Explicitly outside approved scope | Capability flags default disabled; provider/safety prerequisites are missing.                                  |
| Vercel public web deployment                               | Implemented and verified          | `https://jfit.vercel.app/` homepage returned rendered page during deployment review.                           |
| Vercel API production configuration                        | Blocked by external dependency    | Live API health returns `database_unavailable`; project has no environment variables or PostgreSQL connection. |
| Automated CI and release provenance                        | Not implemented                   | Current workflow is an unchanged sample and is not Jfit validation.                                            |
