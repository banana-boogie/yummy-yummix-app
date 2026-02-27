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

const TIERS = [
  { tier: "free", monthlyTextBudgetUsd: 0.10, monthlyVoiceMinutes: 5 },
  { tier: "premium", monthlyTextBudgetUsd: 2.00, monthlyVoiceMinutes: 30 },
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

Deno.test("checkTextBudget - free tier blocks when over budget", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeTextBudgetResult("free", 0.10);
  assertEquals(result.allowed, false);
  assertEquals(result.remainingUsd, 0);
});

Deno.test("checkTextBudget - free tier warns at 80% usage", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  // 80% of $0.10 = $0.08. Use value above threshold (floating point: 0.10*0.8 ≈ 0.080000000000000002)
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

Deno.test("checkTextBudget - premium tier blocks when over budget", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeTextBudgetResult("premium", 2.00);
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

Deno.test("checkVoiceBudget - free tier blocks at limit", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

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

Deno.test("checkVoiceBudget - premium tier blocks at limit", () => {
  _clearTierCache();
  _setTierCacheForTesting(TIERS);

  const result = _computeVoiceBudgetResult("premium", 30);
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
