import { assertEquals } from 'std/assert/mod.ts';
import { consumeBudget, createBudget, takeWithinBudget } from './budget.ts';

Deno.test('createBudget clamps invalid limits to non-negative integers', () => {
  assertEquals(createBudget(-5).remaining, 0);
  assertEquals(createBudget(3.8).remaining, 3);
});

Deno.test('takeWithinBudget caps selected items by remaining budget', () => {
  const budget = createBudget(2);
  assertEquals(takeWithinBudget([1, 2, 3], budget), [1, 2]);
});

Deno.test('consumeBudget decrements and stops at zero', () => {
  const budget = createBudget(1);
  assertEquals(consumeBudget(budget), true);
  assertEquals(budget.remaining, 0);
  assertEquals(consumeBudget(budget), false);
  assertEquals(budget.remaining, 0);
});
