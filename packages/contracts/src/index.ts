export type Currency = 'GBP';
export type PlanId = 'train' | 'pro';
export type BillingInterval = 'month' | 'year';
export type UserRole = 'customer' | 'administrator' | 'content_manager' | 'trainer' | 'commerce' | 'support' | 'finance';
export type ApiError = { error: { code: string; message: string; requestId: string } };
export type Page<T> = { items: T[]; nextCursor: string | null };
export type Money = { amountMinor: number; currency: Currency; taxMinor: number | null };
export type WorkoutSummary = { id: string; title: string; activity: string; durationMinutes: number; difficulty: 'beginner' | 'intermediate' | 'advanced'; requiresMembership: boolean };
export type ProgressWrite = { operationId: string; workoutId: string; completedAt: string; metrics?: Record<string, number | string> };

export const plans = {
  train: { monthlyMinor: 1400, annualMinor: 14400, seats: 1 },
  pro: { monthlyMinor: 3400, annualMinor: 34900, seats: 5 },
} as const;
