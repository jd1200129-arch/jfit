import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Pool, type PoolClient } from "pg";
import { parseCompletionInput, writeCompletion } from "../src/completions.js";
import {
  listProducts,
  parseProductCursor,
  parseProductLimit,
  type Query,
} from "../src/product-pagination.js";
import {
  allowsCookieMutation,
  allowsPublicAuthRequest,
  loginTransport,
} from "../src/request-security.js";
import { createProgressOperation } from "../../mobile/src/offline-progress.js";
import {
  revokeAllNativeSessions,
  revokeNativeSession,
  revokeOtherNativeSession,
} from "../../mobile/src/session-actions.js";
import {
  revokeAllDeviceSessions,
  revokeDeviceSession,
} from "../../web/lib/session-actions.js";

const uuid = (tail: string) =>
  `00000000-0000-4000-8000-${tail.padStart(12, "0")}`;
const testDatabaseUrl = process.env.JFIT_TEST_DATABASE_URL;
const testDatabaseName = testDatabaseUrl
  ? decodeURIComponent(new URL(testDatabaseUrl).pathname.slice(1))
  : "";
const integrationEnabled = Boolean(
  testDatabaseUrl && /(?:^|_)test$/i.test(testDatabaseName),
);

test("product pagination accepts bounded integer limits and a composite cursor only", () => {
  assert.equal(parseProductLimit(null), 20);
  assert.equal(parseProductLimit("1"), 1);
  assert.equal(parseProductLimit("50"), 50);
  for (const invalid of ["0", "51", "-1", "1.5", "1e2", ""])
    assert.equal(parseProductLimit(invalid), null);

  assert.deepEqual(parseProductCursor(`${uuid("1")}:${uuid("2")}`), {
    productId: uuid("1"),
    variantId: uuid("2"),
  });
  assert.equal(parseProductCursor(null), null);
  assert.equal(parseProductCursor(uuid("1")), false);
  assert.equal(parseProductCursor(`${uuid("1")}:bad`), false);
});

test("completion payloads require UUIDs, ISO timestamps and bounded finite metrics", () => {
  const valid = {
    operationId: uuid("1"),
    workoutId: uuid("2"),
    completedAt: "2026-10-19T10:30:00.000Z",
    metrics: { duration: 25, note: "steady" },
  };
  assert.deepEqual(parseCompletionInput(valid), {
    ...valid,
    metrics: { duration: 25, note: "steady" },
  });
  assert.equal(
    parseCompletionInput({ ...valid, operationId: "jfit-123" }),
    null,
  );
  assert.equal(
    parseCompletionInput({ ...valid, completedAt: "yesterday" }),
    null,
  );
  assert.equal(
    parseCompletionInput({ ...valid, metrics: { duration: Number.NaN } }),
    null,
  );
});

test("browser and native auth transports depend on Origin and explicit bearer credentials, not client identity headers", () => {
  const appOrigin = "https://jfit.example";
  assert.equal(allowsPublicAuthRequest(appOrigin, appOrigin), true);
  assert.equal(allowsPublicAuthRequest(undefined, appOrigin), true);
  assert.equal(
    allowsPublicAuthRequest("https://attacker.example", appOrigin),
    false,
  );
  assert.equal(loginTransport(appOrigin, appOrigin), "cookie");
  assert.equal(loginTransport(undefined, appOrigin), "bearer");
  assert.equal(loginTransport("https://attacker.example", appOrigin), "reject");
  assert.equal(allowsCookieMutation(appOrigin, appOrigin), true);
  assert.equal(allowsCookieMutation(undefined, appOrigin), false);
  assert.equal(
    allowsCookieMutation("https://attacker.example", appOrigin),
    false,
  );
});

test("mobile progress operations use strict UUIDs and stable ISO timestamps", () => {
  const operation = createProgressOperation(
    uuid("2"),
    new Date("2026-10-19T10:30:00.000Z"),
  );
  assert.match(
    operation.operationId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  assert.equal(operation.workoutId, uuid("2"));
  assert.equal(operation.completedAt, "2026-10-19T10:30:00.000Z");
});

test("web session actions require confirmed server revocation before resolving", async () => {
  const accepted = async (_url: string, options?: RequestInit) => ({
    ok: true,
    json: async () =>
      options?.method === "POST"
        ? { sessionsRevoked: true }
        : { revoked: true },
  });
  await revokeDeviceSession(accepted, "/sessions/one");
  await revokeAllDeviceSessions(accepted, "/sessions/all");

  const rejected = async () => ({
    ok: true,
    json: async () => ({ revoked: false, sessionsRevoked: false }),
  });
  await assert.rejects(
    () => revokeDeviceSession(rejected, "/sessions/one"),
    /did not confirm/,
  );
  await assert.rejects(
    () => revokeAllDeviceSessions(rejected, "/sessions/all"),
    /did not confirm/,
  );
  await assert.rejects(
    () =>
      revokeDeviceSession(async () => {
        throw new Error("offline");
      }, "/sessions/one"),
    /offline/,
  );
});

test("mobile session actions distinguish confirmed, expired and unconfirmed revocation responses", async () => {
  const confirmed = async (_url: string, options?: RequestInit) => ({
    status: 200,
    ok: true,
    json: async () =>
      options?.method === "DELETE"
        ? { revoked: true }
        : options?.method === "POST" && _url.endsWith("logout-all")
          ? { sessionsRevoked: true }
          : { loggedOut: true },
  });
  assert.equal(
    await revokeNativeSession(
      confirmed,
      "https://jfit.example",
      "token-which-is-long-enough-to-model-a-bearer-session",
    ),
    true,
  );
  assert.equal(
    await revokeNativeSession(
      async () => ({ status: 401, ok: false, json: async () => ({}) }),
      "https://jfit.example",
      "expired-token",
    ),
    true,
  );
  assert.equal(
    await revokeNativeSession(
      async () => ({
        status: 503,
        ok: false,
        json: async () => ({ loggedOut: false }),
      }),
      "https://jfit.example",
      "token",
    ),
    false,
  );
  assert.equal(
    await revokeAllNativeSessions(confirmed, "https://jfit.example", "token"),
    true,
  );
  assert.equal(
    await revokeOtherNativeSession(
      confirmed,
      "https://jfit.example",
      "token",
      uuid("2"),
    ),
    true,
  );
  await assert.rejects(
    () =>
      revokeNativeSession(
        async () => {
          throw new Error("offline");
        },
        "https://jfit.example",
        "token",
      ),
    /offline/,
  );
});

if (!integrationEnabled) {
  test(
    "PostgreSQL pagination and completion integration (set JFIT_TEST_DATABASE_URL to a dedicated *_test database)",
    { skip: "Dedicated PostgreSQL test database is not configured." },
    () => {},
  );
} else {
  const schema = `jfit_it_${randomUUID().replaceAll("-", "")}`;
  let pool: Pool;
  let admin: PoolClient;

  after(async () => {
    if (!pool) return;
    try {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      admin.release();
    } finally {
      await pool.end();
    }
  });

  test("PostgreSQL pagination retains every variant across page boundaries and completion writes are idempotent", async () => {
    pool = new Pool({ connectionString: testDatabaseUrl, max: 4 });
    admin = await pool.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(`CREATE TABLE products (id uuid PRIMARY KEY, slug text, name text, category text, published boolean);
      CREATE TABLE product_variants (id uuid PRIMARY KEY, product_id uuid REFERENCES products(id), sku text, model text, price_minor integer, currency char(3), published boolean);
      CREATE TABLE users (id uuid PRIMARY KEY);
      CREATE TABLE workouts (id uuid PRIMARY KEY, published boolean NOT NULL);
      CREATE TABLE completions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, workout_id uuid NOT NULL,
        operation_id uuid NOT NULL, completed_at timestamptz NOT NULL, metrics jsonb NOT NULL DEFAULT '{}', UNIQUE(user_id,operation_id));`);

    const p1 = uuid("1");
    const p2 = uuid("2");
    await admin.query(
      `INSERT INTO products(id,slug,name,category,published) VALUES($1,'p1','Product one','bike',true),($2,'p2','Product two','rower',true)`,
      [p1, p2],
    );
    await admin.query(
      `INSERT INTO product_variants(id,product_id,sku,model,price_minor,currency,published) VALUES
      ($1,$4,'a','A',1000,'GBP',true),($2,$4,'b','B',1200,'GBP',true),($3,$5,'c','C',900,'GBP',true)`,
      [uuid("10"), uuid("20"), uuid("30"), p1, p2],
    );
    const query: Query = (sql, values) => admin.query(sql, values);
    const first = await listProducts(query, 1, null);
    const second = await listProducts(
      query,
      1,
      parseProductCursor(first.nextCursor)!,
    );
    const third = await listProducts(
      query,
      1,
      parseProductCursor(second.nextCursor)!,
    );
    assert.deepEqual(
      [
        first.items[0].variant_id,
        second.items[0].variant_id,
        third.items[0].variant_id,
      ],
      [uuid("10"), uuid("20"), uuid("30")],
    );
    assert.equal(third.nextCursor, null);

    const userId = uuid("100");
    const workoutId = uuid("200");
    const operationId = uuid("300");
    await admin.query("INSERT INTO users(id) VALUES($1)", [userId]);
    await admin.query("INSERT INTO workouts(id,published) VALUES($1,true)", [
      workoutId,
    ]);
    const input = parseCompletionInput({
      operationId,
      workoutId,
      completedAt: "2026-10-19T10:30:00.000Z",
      metrics: { duration: 25 },
    })!;
    assert.equal((await writeCompletion(query, userId, input)).kind, "created");
    assert.equal(
      (await writeCompletion(query, userId, input)).kind,
      "duplicate",
    );
    assert.equal(
      (
        await writeCompletion(query, userId, {
          ...input,
          metrics: { duration: 26 },
        })
      ).kind,
      "conflict",
    );
    assert.equal(
      (await writeCompletion(query, uuid("101"), input)).kind,
      "created",
    );
    assert.equal(
      (
        await writeCompletion(query, userId, {
          ...input,
          workoutId: uuid("201"),
        })
      ).kind,
      "conflict",
    );
    await admin.query("INSERT INTO workouts(id,published) VALUES($1,false)", [
      uuid("202"),
    ]);
    assert.equal(
      (
        await writeCompletion(query, userId, {
          ...input,
          operationId: uuid("301"),
          workoutId: uuid("202"),
        })
      ).kind,
      "unavailable",
    );

    const clients = await Promise.all([pool.connect(), pool.connect()]);
    try {
      await Promise.all(
        clients.map((client) => client.query(`SET search_path TO "${schema}"`)),
      );
      const simultaneous = await Promise.all(
        clients.map((client) =>
          writeCompletion((sql, values) => client.query(sql, values), userId, {
            ...input,
            operationId: uuid("302"),
          }),
        ),
      );
      assert.deepEqual(simultaneous.map((result) => result.kind).sort(), [
        "created",
        "duplicate",
      ]);
    } finally {
      clients.forEach((client) => client.release());
    }
  });
}
