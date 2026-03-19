/**
 * Semantic Recipe Search - Smoke Tests
 *
 * Since the edge function uses Deno.serve, we cannot easily test the handler
 * directly. These tests verify that the shared dependencies used by the
 * function work correctly with the expected inputs.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildLocaleChain } from "../../_shared/locale-utils.ts";

// ============================================================
// buildLocaleChain integration with semantic-recipe-search
// ============================================================

Deno.test('buildLocaleChain works with default locale "en"', () => {
  const chain = buildLocaleChain("en");
  assertEquals(chain, ["en"]);
});

Deno.test('buildLocaleChain works with "es" locale', () => {
  const chain = buildLocaleChain("es");
  assertEquals(chain, ["es"]);
});

Deno.test('buildLocaleChain works with regional locale "es-MX"', () => {
  const chain = buildLocaleChain("es-MX");
  assertEquals(chain, ["es-MX", "es"]);
});

Deno.test('buildLocaleChain works with regional locale "en-US"', () => {
  const chain = buildLocaleChain("en-US");
  assertEquals(chain, ["en-US", "en"]);
});
