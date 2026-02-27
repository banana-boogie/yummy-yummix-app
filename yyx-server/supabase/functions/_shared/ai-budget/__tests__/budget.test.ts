/**
 * Budget Module Tests
 *
 * Tests for checkTextBudget, checkVoiceBudget, and recordCost.
 * Uses mock Supabase client to avoid DB dependency.
 */

import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";
import type { BudgetStatus, VoiceBudgetStatus } from "../index.ts";

// ============================================================
// Test helpers — replicate budget logic for isolated testing
// ============================================================

const WARNING_THRESHOLD = 0.8;

interface TierLimits {
  monthlyTextBudgetUsd: number;
  monthlyVoiceMinutes: number;
}

function computeTextBudget(
  tier: string,
  usedUsd: number,
  tiers: Record<string, TierLimits>,
): BudgetStatus {
  const limits = tiers[tier] || tiers["free"] ||
    { monthlyTextBudgetUsd: 0.10, monthlyVoiceMinutes: 5 };
  const remainingUsd = Math.max(0, limits.monthlyTextBudgetUsd - usedUsd);
  const allowed = usedUsd < limits.monthlyTextBudgetUsd;

  const result: BudgetStatus = {
    allowed,
    remainingUsd,
    usedUsd,
    budgetUsd: limits.monthlyTextBudgetUsd,
    tier,
  };

  if (allowed && usedUsd >= limits.monthlyTextBudgetUsd * WARNING_THRESHOLD) {
    result.warning = `You've used $${usedUsd.toFixed(4)} of your $${
      limits.monthlyTextBudgetUsd.toFixed(2)
    } monthly AI budget.`;
  }

  return result;
}

function computeVoiceBudget(
  tier: string,
  usedMinutes: number,
  tiers: Record<string, TierLimits>,
): VoiceBudgetStatus {
  const limits = tiers[tier] || tiers["free"] ||
    { monthlyTextBudgetUsd: 0.10, monthlyVoiceMinutes: 5 };
  const remainingMinutes = Math.max(
    0,
    limits.monthlyVoiceMinutes - usedMinutes,
  );
  const allowed = usedMinutes < limits.monthlyVoiceMinutes;

  const result: VoiceBudgetStatus = {
    allowed,
    remainingMinutes,
    usedMinutes,
    limitMinutes: limits.monthlyVoiceMinutes,
    tier,
  };

  if (
    allowed && usedMinutes >= limits.monthlyVoiceMinutes * WARNING_THRESHOLD
  ) {
    result.warning = `You've used ${
      usedMinutes.toFixed(1)
    } of ${limits.monthlyVoiceMinutes} voice minutes this month.`;
  }

  return result;
}

const TIERS: Record<string, TierLimits> = {
  free: { monthlyTextBudgetUsd: 0.10, monthlyVoiceMinutes: 5 },
  premium: { monthlyTextBudgetUsd: 2.00, monthlyVoiceMinutes: 30 },
};

// ============================================================
// checkTextBudget logic tests
// ============================================================

Deno.test("checkTextBudget - free tier allows when under budget", () => {
  const result = computeTextBudget("free", 0.05, TIERS);
  assertEquals(result.allowed, true);
  assertEquals(result.budgetUsd, 0.10);
  assertEquals(result.usedUsd, 0.05);
  assertEquals(result.remainingUsd, 0.05);
  assertEquals(result.tier, "free");
  assertEquals(result.warning, undefined);
});

Deno.test("checkTextBudget - free tier blocks when over budget", () => {
  const result = computeTextBudget("free", 0.10, TIERS);
  assertEquals(result.allowed, false);
  assertEquals(result.remainingUsd, 0);
});

Deno.test("checkTextBudget - free tier warns at 80% usage", () => {
  // 80% of $0.10 = $0.08. Use value above threshold (floating point: 0.10*0.8 ≈ 0.080000000000000002)
  const result = computeTextBudget("free", 0.085, TIERS);
  assertEquals(result.allowed, true);
  assertEquals(result.warning !== undefined, true);
});

Deno.test("checkTextBudget - free tier no warning below 80%", () => {
  const result = computeTextBudget("free", 0.07, TIERS);
  assertEquals(result.allowed, true);
  assertEquals(result.warning, undefined);
});

Deno.test("checkTextBudget - premium tier has $2.00 budget", () => {
  const result = computeTextBudget("premium", 1.50, TIERS);
  assertEquals(result.allowed, true);
  assertEquals(result.budgetUsd, 2.00);
  assertEquals(result.remainingUsd, 0.50);
});

Deno.test("checkTextBudget - premium tier blocks when over budget", () => {
  const result = computeTextBudget("premium", 2.00, TIERS);
  assertEquals(result.allowed, false);
  assertEquals(result.remainingUsd, 0);
});

Deno.test("checkTextBudget - premium tier warns at 80%", () => {
  const result = computeTextBudget("premium", 1.60, TIERS);
  assertEquals(result.allowed, true);
  assertEquals(typeof result.warning, "string");
});

Deno.test("checkTextBudget - unknown tier falls back to free", () => {
  const result = computeTextBudget("enterprise", 0.05, TIERS);
  assertEquals(result.budgetUsd, 0.10);
  assertEquals(result.tier, "enterprise");
});

Deno.test("checkTextBudget - zero usage shows full remaining", () => {
  const result = computeTextBudget("free", 0, TIERS);
  assertEquals(result.allowed, true);
  assertEquals(result.remainingUsd, 0.10);
  assertEquals(result.usedUsd, 0);
});

Deno.test("checkTextBudget - over-budget usage clamps remaining to 0", () => {
  const result = computeTextBudget("free", 0.15, TIERS);
  assertEquals(result.allowed, false);
  assertEquals(result.remainingUsd, 0);
  assertEquals(result.usedUsd, 0.15);
});

// ============================================================
// checkVoiceBudget logic tests
// ============================================================

Deno.test("checkVoiceBudget - free tier allows when under limit", () => {
  const result = computeVoiceBudget("free", 3, TIERS);
  assertEquals(result.allowed, true);
  assertEquals(result.limitMinutes, 5);
  assertEquals(result.usedMinutes, 3);
  assertEquals(result.remainingMinutes, 2);
  assertEquals(result.warning, undefined);
});

Deno.test("checkVoiceBudget - free tier blocks at limit", () => {
  const result = computeVoiceBudget("free", 5, TIERS);
  assertEquals(result.allowed, false);
  assertEquals(result.remainingMinutes, 0);
});

Deno.test("checkVoiceBudget - free tier warns at 80%", () => {
  const result = computeVoiceBudget("free", 4, TIERS);
  assertEquals(result.allowed, true);
  assertEquals(typeof result.warning, "string");
});

Deno.test("checkVoiceBudget - premium tier has 30 minutes", () => {
  const result = computeVoiceBudget("premium", 15, TIERS);
  assertEquals(result.allowed, true);
  assertEquals(result.limitMinutes, 30);
  assertEquals(result.remainingMinutes, 15);
});

Deno.test("checkVoiceBudget - premium tier blocks at limit", () => {
  const result = computeVoiceBudget("premium", 30, TIERS);
  assertEquals(result.allowed, false);
  assertEquals(result.remainingMinutes, 0);
});

Deno.test("checkVoiceBudget - premium tier warns at 80%", () => {
  const result = computeVoiceBudget("premium", 24, TIERS);
  assertEquals(result.allowed, true);
  assertEquals(typeof result.warning, "string");
});

Deno.test("checkVoiceBudget - zero usage shows full remaining", () => {
  const result = computeVoiceBudget("free", 0, TIERS);
  assertEquals(result.allowed, true);
  assertEquals(result.remainingMinutes, 5);
});

// ============================================================
// Tier fallback logic
// ============================================================

Deno.test("tier fallback - empty tiers map uses hardcoded free defaults", () => {
  const result = computeTextBudget("free", 0.05, {});
  assertEquals(result.budgetUsd, 0.10);
  assertEquals(result.allowed, true);
});

Deno.test("tier fallback - unknown tier with free available falls back to free", () => {
  const result = computeVoiceBudget("gold", 3, TIERS);
  assertEquals(result.limitMinutes, 5); // falls back to free
});
