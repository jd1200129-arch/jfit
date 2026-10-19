import { uuidPattern, type Query } from "./product-pagination.js";

export type CompletionInput = {
  operationId: string;
  workoutId: string;
  completedAt: string;
  metrics: Record<string, number | string>;
};

const isoTimestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function validTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !isoTimestampPattern.test(value))
    return false;
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString() !== "Invalid Date"
  );
}

export function parseCompletionInput(
  value: Record<string, unknown>,
): CompletionInput | null {
  if (
    typeof value.operationId !== "string" ||
    !uuidPattern.test(value.operationId) ||
    typeof value.workoutId !== "string" ||
    !uuidPattern.test(value.workoutId) ||
    !validTimestamp(value.completedAt)
  )
    return null;

  const sourceMetrics = value.metrics ?? {};
  if (
    !sourceMetrics ||
    typeof sourceMetrics !== "object" ||
    Array.isArray(sourceMetrics)
  )
    return null;
  const entries = Object.entries(sourceMetrics);
  if (entries.length > 20) return null;
  const normalizedEntries: Array<[string, number | string]> = [];
  for (const [key, metric] of entries.sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (key.length < 1 || key.length > 64) return null;
    if (typeof metric === "number" && Number.isFinite(metric))
      normalizedEntries.push([key, metric]);
    else if (typeof metric === "string" && metric.length <= 200)
      normalizedEntries.push([key, metric]);
    else return null;
  }

  return {
    operationId: value.operationId.toLowerCase(),
    workoutId: value.workoutId.toLowerCase(),
    completedAt: value.completedAt,
    metrics: Object.fromEntries(normalizedEntries),
  };
}

type StoredCompletion = {
  id: string;
  workout_id: string;
  operation_id: string;
  completed_at: Date | string;
  metrics: Record<string, number | string>;
};

export type CompletionWriteResult =
  | { kind: "created" | "duplicate"; completion: StoredCompletion }
  | { kind: "conflict" }
  | { kind: "unavailable" };

function timestampMillis(value: Date | string): number {
  return new Date(value).getTime();
}

function stableMetrics(value: Record<string, number | string>): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
}

export async function writeCompletion(
  query: Query,
  userId: string,
  input: CompletionInput,
): Promise<CompletionWriteResult> {
  const inserted = await query<StoredCompletion>(
    `
    INSERT INTO completions(user_id,workout_id,operation_id,completed_at,metrics)
      SELECT $1,$2,$3,$4::timestamptz,$5::jsonb
       WHERE EXISTS (SELECT 1 FROM workouts WHERE id=$2 AND published)
    ON CONFLICT(user_id,operation_id) DO NOTHING
    RETURNING id,workout_id,operation_id,completed_at,metrics`,
    [
      userId,
      input.workoutId,
      input.operationId,
      input.completedAt,
      JSON.stringify(input.metrics),
    ],
  );
  if (inserted.rows[0])
    return { kind: "created", completion: inserted.rows[0] };

  const prior = await query<StoredCompletion>(
    `SELECT id,workout_id,operation_id,completed_at,metrics
    FROM completions WHERE user_id=$1 AND operation_id=$2`,
    [userId, input.operationId],
  );
  const completion = prior.rows[0];
  if (!completion) return { kind: "unavailable" };

  const sameWrite =
    completion.workout_id === input.workoutId &&
    timestampMillis(completion.completed_at) ===
      Date.parse(input.completedAt) &&
    stableMetrics(completion.metrics) === stableMetrics(input.metrics);
  return sameWrite ? { kind: "duplicate", completion } : { kind: "conflict" };
}
