// The stable operation ID is generated once on the device and must be reused for retries.
export type ProgressOperation = { operationId: string; workoutId: string; completedAt: string };
export function createProgressOperation(workoutId: string, now = new Date()): ProgressOperation {
  return { operationId: `jfit-${now.getTime()}-${Math.random().toString(36).slice(2)}`, workoutId, completedAt: now.toISOString() };
}
