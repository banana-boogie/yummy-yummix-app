/**
 * Pricing Module Tests
 *
 * Tests real calculateCost with preloaded in-memory cache.
 */

import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";
import { _clearCache, _setCacheForTesting, calculateCost } from "../pricing.ts";

Deno.test("calculateCost - gemini-2.5-flash pricing", async () => {
  _clearCache();
  _setCacheForTesting([
    {
      model: "gemini-2.5-flash",
      inputPricePerMillion: 0.15,
      outputPricePerMillion: 0.60,
    },
  ]);

  const cost = await calculateCost("gemini-2.5-flash", 1000, 500);
  // 1000/1M * 0.15 + 500/1M * 0.60 = 0.00015 + 0.00030 = 0.00045
  assertEquals(Math.round(cost * 100000) / 100000, 0.00045);
});

Deno.test("calculateCost - gpt-4.1-nano pricing", async () => {
  _clearCache();
  _setCacheForTesting([
    {
      model: "gpt-4.1-nano",
      inputPricePerMillion: 0.10,
      outputPricePerMillion: 0.40,
    },
  ]);

  const cost = await calculateCost("gpt-4.1-nano", 5000, 2000);
  // 5000/1M * 0.10 + 2000/1M * 0.40 = 0.0005 + 0.0008 = 0.0013
  assertEquals(Math.round(cost * 10000) / 10000, 0.0013);
});

Deno.test("calculateCost - zero tokens = zero cost", async () => {
  _clearCache();
  _setCacheForTesting([
    {
      model: "gemini-2.5-flash",
      inputPricePerMillion: 0.15,
      outputPricePerMillion: 0.60,
    },
  ]);

  const cost = await calculateCost("gemini-2.5-flash", 0, 0);
  assertEquals(cost, 0);
});

Deno.test("calculateCost - embedding (no output tokens)", async () => {
  _clearCache();
  _setCacheForTesting([
    {
      model: "text-embedding-3-large",
      inputPricePerMillion: 0.13,
      outputPricePerMillion: 0,
    },
  ]);

  const cost = await calculateCost("text-embedding-3-large", 10000, 0);
  // 10000/1M * 0.13 = 0.0013
  assertEquals(Math.round(cost * 10000) / 10000, 0.0013);
});

Deno.test("calculateCost - large token counts", async () => {
  _clearCache();
  _setCacheForTesting([
    {
      model: "gemini-2.5-flash",
      inputPricePerMillion: 0.15,
      outputPricePerMillion: 0.60,
    },
  ]);

  const cost = await calculateCost("gemini-2.5-flash", 1_000_000, 500_000);
  // 1 * 0.15 + 0.5 * 0.60 = 0.15 + 0.30 = 0.45
  assertEquals(Math.round(cost * 100) / 100, 0.45);
});
