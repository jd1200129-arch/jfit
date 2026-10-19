# Testing strategy

## Current baseline

The repository has Node's built-in test runner and two staff-permission unit tests. There is no lockfile, CI quality pipeline, PostgreSQL test service, web/mobile component test framework, or recorded device build. Do not infer successful integration coverage from typechecking or a browser page load.

## Required layers

1. **Unit:** validation and cursor parsing, permissions, transport selection, session action response handling, idempotency comparison, shared plan calculations, worker retry policy.
2. **Database integration:** run migrations against an isolated PostgreSQL service; verify constraints, multi-variant pagination across page boundaries, completion idempotency/conflicts/concurrency and user isolation, account/session revocation, and outbox claiming.
3. **API integration:** exercise HTTP routes with a disposable database, including origin/CSRF cases, cookie and bearer transports, errors, throttling, unpublished resources and malformed requests.
4. **Web/mobile interaction:** form validation/loading/error/empty states; confirmed logout behaviour; keyboard and accessibility semantics; responsive routes; offline session/progress recovery.
5. **End-to-end/provider sandbox:** registration to email verification, account recovery, catalog/cart/checkout/refund, subscription/webhooks/seat concurrency and authorised workout playback.
6. **Build/release:** clean `npm ci`, all workspace typechecks, web production build, API/worker build, dependency audit, secret scan and migration validation.

## Safe database test setup

Database integration tests must use a dedicated disposable database named with a clear `_test` suffix and must refuse to run otherwise. They may create/drop only a uniquely named temporary schema in that database. Production/staging URLs must never be used. CI should provision PostgreSQL as a service and pass `JFIT_TEST_DATABASE_URL` to integration tests.

## Evidence reporting

Record exact commands, exit codes, pass/fail/skip counts and prerequisites. A skipped database test is not a pass for its acceptance criterion. Do not weaken assertions or substitute mock “success” responses for an unavailable provider.
