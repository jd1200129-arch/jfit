// The stable operation ID is generated once on the device and must be reused for retries.
export type ProgressOperation = {
  operationId: string;
  workoutId: string;
  completedAt: string;
};
export function createProgressOperation(
  workoutId: string,
  now = new Date(),
): ProgressOperation {
  const operationId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (slot) => {
      const random = Math.floor(Math.random() * 16);
      return (slot === "x" ? random : (random & 0x3) | 0x8).toString(16);
    },
  );
  return { operationId, workoutId, completedAt: now.toISOString() };
}
