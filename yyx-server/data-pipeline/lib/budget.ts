/**
 * Shared helpers for enforcing a global processing budget.
 */

export interface RemainingBudget {
  remaining: number;
}

export function createBudget(limit: number): RemainingBudget {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  return { remaining: safeLimit };
}

export function takeWithinBudget<T>(items: T[], budget: RemainingBudget): T[] {
  return items.slice(0, budget.remaining);
}

export function consumeBudget(budget: RemainingBudget): boolean {
  if (budget.remaining <= 0) return false;
  budget.remaining -= 1;
  return true;
}
