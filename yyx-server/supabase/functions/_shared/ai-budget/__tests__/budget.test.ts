/**
 * Budget Module Tests
 *
 * Tests real _computeTextBudgetResult and _computeVoiceBudgetResult
 * with preloaded in-memory tier cache. Same pattern as pricing.test.ts.
 */

import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";
import {
  _clearTierCache,
  _computeTextBudgetResult,
  _computeVoiceBudgetResult,
  _setTierCacheForTesting,
} from "../index.ts";

// Default tiers with 10% grace buffer (matches DB default)
const TIERS = [
  { tier: "free", monthlyTextBudgetUsd: 0.10, monthlyVoiceMinutes: 5 },
  { tier: "premium", monthlyTextBudgetUsd: 2.00, monthlyVoiceMinutes: 30 },
];

// Tiers with no grace buffer for strict-boundary tests
const TIERS_NO_GRACE = [
  { tier: "free", monthlyTextBudgetUsd: 0.10, monthlyVoiceMinutes: 5, graceBufferPct: 0 },
  { tier: "premium", monthlyTextBudgetUsd: 2.00, monthlyVoiceMinutes: 30, graceBufferPct: 0 },
];

// ============================================================
// checkTextBudget logic tests
// ============================================================

Deno.test("checkTextBudget - free tier allows when under budget", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeTextBudgetResult("free", 0.05);
  assertEquals(result.allowed, true);
  assertEquals(result.budgetUsd, 0.10);
  assertEquals(result.usedUsd, 0.05);
  assertEquals(result.remainingUsd, 0.05);
  assertEquals(result.tier, "free");
  assertEquals(result.warning, undefined);
});

Deno.test("checkTextBudget - free tier allows in grace zone (between budget and effective limit)", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  // $0.105 is above $0.10 budget but below $0.11 effective limit (10% grace)
  const result = _computeTextBudgetResult("free", 0.105);
  assertEquals(result.allowed, true);
  assertEquals(result.remainingUsd, 0); // User sees 0 remaining (budget is $0.10)
  assertEquals(result.warning, "budget_warning"); // Still shows warning
});

Deno.test("checkTextBudget - free tier blocks when over effective limit (budget + grace)", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  // Effective limit is $0.10 * 1.10 = $0.11. Use $0.12 to be clearly beyond.
  const result = _computeTextBudgetResult("free", 0.12);
  assertEquals(result.allowed, false);
  assertEquals(result.remainingUsd, 0);
});

Deno.test("checkTextBudget - blocks at exact budget when grace is 0", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS_NO_GRACE);

  const result = _computeTextBudgetResult("free", 0.10);
  assertEquals(result.allowed, false);
  assertEquals(result.remainingUsd, 0);
});

Deno.test("checkTextBudget - free tier warns at 80% usage", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  // 80% of $0.10 = $0.08. Use value above threshold
  const result = _computeTextBudgetResult("free", 0.085);
  assertEquals(result.allowed, true);
  assertEquals(result.warning, "budget_warning");
  assertEquals(result.warningData?.usedUsd, 0.085);
  assertEquals(result.warningData?.budgetUsd, 0.10);
});

Deno.test("checkTextBudget - free tier no warning below 80%", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeTextBudgetResult("free", 0.07);
  assertEquals(result.allowed, true);
  assertEquals(result.warning, undefined);
  assertEquals(result.warningData, undefined);
});

Deno.test("checkTextBudget - premium tier has $2.00 budget", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeTextBudgetResult("premium", 1.50);
  assertEquals(result.allowed, true);
  assertEquals(result.budgetUsd, 2.00);
  assertEquals(result.remainingUsd, 0.50);
});

Deno.test("checkTextBudget - premium tier allows in grace zone", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  // $2.10 is within grace ($2.00 * 1.10 = $2.20 effective)
  const result = _computeTextBudgetResult("premium", 2.10);
  assertEquals(result.allowed, true);
  assertEquals(result.remainingUsd, 0);
});

Deno.test("checkTextBudget - premium tier blocks when over effective limit", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  // $2.20 = $2.00 * 1.10 effective limit
  const result = _computeTextBudgetResult("premium", 2.20);
  assertEquals(result.allowed, false);
  assertEquals(result.remainingUsd, 0);
});

Deno.test("checkTextBudget - premium tier warns at 80%", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeTextBudgetResult("premium", 1.60);
  assertEquals(result.allowed, true);
  assertEquals(result.warning, "budget_warning");
});

Deno.test("checkTextBudget - unknown tier falls back to free", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeTextBudgetResult("enterprise", 0.05);
  assertEquals(result.budgetUsd, 0.10);
  assertEquals(result.tier, "enterprise");
});

Deno.test("checkTextBudget - zero usage shows full remaining", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeTextBudgetResult("free", 0);
  assertEquals(result.allowed, true);
  assertEquals(result.remainingUsd, 0.10);
  assertEquals(result.usedUsd, 0);
});

Deno.test("checkTextBudget - over-budget usage clamps remaining to 0", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeTextBudgetResult("free", 0.15);
  assertEquals(result.allowed, false);
  assertEquals(result.remainingUsd, 0);
  assertEquals(result.usedUsd, 0.15);
});

// ============================================================
// checkVoiceBudget logic tests
// ============================================================

Deno.test("checkVoiceBudget - free tier allows when under limit", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeVoiceBudgetResult("free", 3);
  assertEquals(result.allowed, true);
  assertEquals(result.limitMinutes, 5);
  assertEquals(result.usedMinutes, 3);
  assertEquals(result.remainingMinutes, 2);
  assertEquals(result.warning, undefined);
});

Deno.test("checkVoiceBudget - free tier allows in grace zone", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  // 5.2 minutes is above 5 but below 5.5 (5 * 1.10 effective)
  const result = _computeVoiceBudgetResult("free", 5.2);
  assertEquals(result.allowed, true);
  assertEquals(result.remainingMinutes, 0);
});

Deno.test("checkVoiceBudget - free tier blocks past effective limit", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  // 5.5 = 5 * 1.10 effective limit
  const result = _computeVoiceBudgetResult("free", 5.5);
  assertEquals(result.allowed, false);
  assertEquals(result.remainingMinutes, 0);
});

Deno.test("checkVoiceBudget - blocks at exact limit when grace is 0", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS_NO_GRACE);

  const result = _computeVoiceBudgetResult("free", 5);
  assertEquals(result.allowed, false);
  assertEquals(result.remainingMinutes, 0);
});

Deno.test("checkVoiceBudget - free tier warns at 80%", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeVoiceBudgetResult("free", 4);
  assertEquals(result.allowed, true);
  assertEquals(result.warning, "voice_budget_warning");
  assertEquals(result.warningData?.usedMinutes, 4);
  assertEquals(result.warningData?.limitMinutes, 5);
});

Deno.test("checkVoiceBudget - premium tier has 30 minutes", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeVoiceBudgetResult("premium", 15);
  assertEquals(result.allowed, true);
  assertEquals(result.limitMinutes, 30);
  assertEquals(result.remainingMinutes, 15);
});

Deno.test("checkVoiceBudget - premium tier allows in grace zone", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  // 32 minutes is within grace (30 * 1.10 = 33 effective)
  const result = _computeVoiceBudgetResult("premium", 32);
  assertEquals(result.allowed, true);
  assertEquals(result.remainingMinutes, 0);
});

Deno.test("checkVoiceBudget - premium tier blocks past effective limit", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  // 33 = 30 * 1.10
  const result = _computeVoiceBudgetResult("premium", 33);
  assertEquals(result.allowed, false);
  assertEquals(result.remainingMinutes, 0);
});

Deno.test("checkVoiceBudget - premium tier warns at 80%", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeVoiceBudgetResult("premium", 24);
  assertEquals(result.allowed, true);
  assertEquals(result.warning, "voice_budget_warning");
});

Deno.test("checkVoiceBudget - zero usage shows full remaining", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeVoiceBudgetResult("free", 0);
  assertEquals(result.allowed, true);
  assertEquals(result.remainingMinutes, 5);
});

// ============================================================
// Exact boundary tests
// ============================================================

Deno.test("checkTextBudget - at 80% threshold triggers warning (premium, no float issues)", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  // 80% of $2.00 = $1.60 exactly
  const result = _computeTextBudgetResult("premium", 1.60);
  assertEquals(result.allowed, true);
  assertEquals(result.warning, "budget_warning");
});

Deno.test("checkTextBudget - just below 80% threshold has no warning", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeTextBudgetResult("premium", 1.59);
  assertEquals(result.allowed, true);
  assertEquals(result.warning, undefined);
});

Deno.test("checkVoiceBudget - exactly at 80% threshold triggers warning", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  // 80% of 5 = 4.0 exactly
  const result = _computeVoiceBudgetResult("free", 4.0);
  assertEquals(result.allowed, true);
  assertEquals(result.warning, "voice_budget_warning");
});

Deno.test("checkVoiceBudget - just below 80% threshold has no warning", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeVoiceBudgetResult("free", 3.9);
  assertEquals(result.allowed, true);
  assertEquals(result.warning, undefined);
});

// ============================================================
// Warning data shape tests
// ============================================================

Deno.test("checkTextBudget - warningData has correct fields when warning fires", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeTextBudgetResult("premium", 1.70);
  assertEquals(result.warning, "budget_warning");
  assertEquals(typeof result.warningData, "object");
  assertEquals(result.warningData!.usedUsd, 1.70);
  assertEquals(result.warningData!.budgetUsd, 2.00);
});

Deno.test("checkVoiceBudget - warningData has correct fields when warning fires", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeVoiceBudgetResult("premium", 25);
  assertEquals(result.warning, "voice_budget_warning");
  assertEquals(typeof result.warningData, "object");
  assertEquals(result.warningData!.usedMinutes, 25);
  assertEquals(result.warningData!.limitMinutes, 30);
});

// ============================================================
// Tier fallback logic
// ============================================================

Deno.test("tier fallback - empty cache uses hardcoded free defaults", () => {
  _clearTierCache();

  const result = _computeTextBudgetResult("free", 0.05);
  assertEquals(result.budgetUsd, 0.10);
  assertEquals(result.allowed, true);
});

Deno.test("tier fallback - unknown tier with free available falls back to free", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeVoiceBudgetResult("gold", 3);
  assertEquals(result.limitMinutes, 5); // falls back to free
});

// ============================================================
// Grace buffer specific tests
// ============================================================

Deno.test("grace buffer - warning fires at 80% of advertised budget, not effective limit", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  // 80% of $0.10 = $0.08. $0.085 > $0.08, warning should fire based on advertised budget
  const result = _computeTextBudgetResult("free", 0.085);
  assertEquals(result.allowed, true);
  assertEquals(result.warning, "budget_warning");
  // budgetUsd should be the advertised budget, not the effective limit
  assertEquals(result.budgetUsd, 0.10);
});

Deno.test("grace buffer - remainingUsd is based on advertised budget not effective limit", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  // In grace zone: allowed but remaining shows 0 (user sees real budget)
  const result = _computeTextBudgetResult("free", 0.105);
  assertEquals(result.allowed, true);
  assertEquals(result.remainingUsd, 0);
  assertEquals(result.budgetUsd, 0.10); // advertised, not effective
});

Deno.test("grace buffer - custom grace percentage works", () => {
  _clearTierCache();
  _setTierCacheForTesting([
    { tier: "free", monthlyTextBudgetUsd: 1.00, monthlyVoiceMinutes: 10, graceBufferPct: 0.20 },
  ]);

  // Effective limit = $1.00 * 1.20 = $1.20
  const atBudget = _computeTextBudgetResult("free", 1.00);
  assertEquals(atBudget.allowed, true); // In grace zone

  const inGrace = _computeTextBudgetResult("free", 1.15);
  assertEquals(inGrace.allowed, true); // Still in grace

  const pastGrace = _computeTextBudgetResult("free", 1.20);
  assertEquals(pastGrace.allowed, false); // Beyond effective limit
});

Deno.test("grace buffer - 111% of budget (beyond 10% grace) is blocked", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  // 111% of $2.00 = $2.22, effective limit = $2.00 * 1.10 = $2.20
  const result = _computeTextBudgetResult("premium", 2.22);
  assertEquals(result.allowed, false);
  assertEquals(result.remainingUsd, 0);
});

Deno.test("grace buffer - 111% of voice budget (beyond 10% grace) is blocked", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  // 111% of 30 minutes = 33.3, effective limit = 30 * 1.10 = 33
  const result = _computeVoiceBudgetResult("premium", 33.3);
  assertEquals(result.allowed, false);
  assertEquals(result.remainingMinutes, 0);
});

Deno.test("grace buffer - zero grace behaves like strict budget", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS_NO_GRACE);

  const atBudget = _computeTextBudgetResult("free", 0.10);
  assertEquals(atBudget.allowed, false);

  const justUnder = _computeTextBudgetResult("free", 0.099);
  assertEquals(justUnder.allowed, true);
});
