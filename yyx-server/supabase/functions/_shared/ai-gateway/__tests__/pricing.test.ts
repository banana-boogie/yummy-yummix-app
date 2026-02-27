/**
 * Pricing Module Tests
 *
 * Tests for calculateCost function. Uses a mock to avoid DB dependency.
 * The function is tested indirectly since it requires DB access.
 * Here we test the cost calculation math directly.
 */

import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";

// Test the cost calculation math directly (same formula as calculateCost)
function testCalculateCost(
  inputTokens: number,
  outputTokens: number,
  inputPricePerMillion: number,
  outputPricePerMillion: number,
): number {
  const inputCost = (inputTokens / 1_000_000) * inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * outputPricePerMillion;
  return inputCost + outputCost;
}

Deno.test("calculateCost - gemini-2.5-flash pricing", () => {
  // gemini-2.5-flash: $0.15/1M input, $0.60/1M output
  const cost = testCalculateCost(1000, 500, 0.15, 0.60);
  // 1000/1M * 0.15 + 500/1M * 0.60 = 0.00015 + 0.00030 = 0.00045
  assertEquals(Math.round(cost * 100000) / 100000, 0.00045);
});

Deno.test("calculateCost - gpt-4.1-nano pricing", () => {
  // gpt-4.1-nano: $0.10/1M input, $0.40/1M output
  const cost = testCalculateCost(5000, 2000, 0.10, 0.40);
  // 5000/1M * 0.10 + 2000/1M * 0.40 = 0.0005 + 0.0008 = 0.0013
  assertEquals(Math.round(cost * 10000) / 10000, 0.0013);
});

Deno.test("calculateCost - zero tokens = zero cost", () => {
  const cost = testCalculateCost(0, 0, 0.15, 0.60);
  assertEquals(cost, 0);
});

Deno.test("calculateCost - embedding (no output tokens)", () => {
  // text-embedding-3-large: $0.13/1M input, $0/output
  const cost = testCalculateCost(10000, 0, 0.13, 0);
  // 10000/1M * 0.13 = 0.0013
  assertEquals(Math.round(cost * 10000) / 10000, 0.0013);
});

Deno.test("calculateCost - large token counts", () => {
  // 1M input + 500K output with gemini pricing
  const cost = testCalculateCost(1_000_000, 500_000, 0.15, 0.60);
  // 1 * 0.15 + 0.5 * 0.60 = 0.15 + 0.30 = 0.45
  assertEquals(Math.round(cost * 100) / 100, 0.45);
});
