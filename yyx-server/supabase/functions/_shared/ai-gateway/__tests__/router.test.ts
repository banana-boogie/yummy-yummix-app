/**
 * AI Gateway Router Tests
 *
 * Tests for routing configuration:
 * - New usage types resolve correctly
 * - All usage types have valid configs
 * - No env var override remnants
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.0/assert/mod.ts";
import { getAvailableUsageTypes, getProviderConfig } from "../router.ts";

// =============================================================================
// getProviderConfig
// =============================================================================

Deno.test("getProviderConfig - recipe_creation resolves to openai/gpt-5-mini", () => {
  const config = getProviderConfig("recipe_creation");
  assertEquals(config.provider, "openai");
  assertEquals(config.model, "gpt-5-mini");
  assertEquals(config.apiKeyEnvVar, "OPENAI_API_KEY");
});

Deno.test("getProviderConfig - recipe_formatting resolves to openai/gpt-5-nano", () => {
  const config = getProviderConfig("recipe_formatting");
  assertEquals(config.provider, "openai");
  assertEquals(config.model, "gpt-5-nano");
  assertEquals(config.apiKeyEnvVar, "OPENAI_API_KEY");
});

Deno.test("getProviderConfig - text resolves to google/gemini-2.5-flash", () => {
  const config = getProviderConfig("text");
  assertEquals(config.provider, "google");
  assertEquals(config.model, "gemini-2.5-flash");
  assertEquals(config.apiKeyEnvVar, "GEMINI_API_KEY");
});

Deno.test("getProviderConfig - recipe_generation (legacy) resolves to google", () => {
  const config = getProviderConfig("recipe_generation");
  assertEquals(config.provider, "google");
});

Deno.test("getProviderConfig - recipe_modification resolves to google", () => {
  const config = getProviderConfig("recipe_modification");
  assertEquals(config.provider, "google");
});

Deno.test("getProviderConfig - parsing resolves to openai/gpt-4.1-nano", () => {
  const config = getProviderConfig("parsing");
  assertEquals(config.provider, "openai");
  assertEquals(config.model, "gpt-4.1-nano");
});

Deno.test("getProviderConfig - embedding resolves to openai", () => {
  const config = getProviderConfig("embedding");
  assertEquals(config.provider, "openai");
  assertEquals(config.model, "text-embedding-3-large");
});

Deno.test("getProviderConfig - does not read env vars (no override support)", () => {
  const originalEnv = Deno.env.get("AI_TEXT_MODEL");
  Deno.env.set("AI_TEXT_MODEL", "openai:gpt-4.1-mini");

  try {
    const config = getProviderConfig("text");
    // Should still be google/gemini, ignoring env var
    assertEquals(config.provider, "google");
    assertEquals(config.model, "gemini-2.5-flash");
  } finally {
    if (originalEnv === undefined) {
      Deno.env.delete("AI_TEXT_MODEL");
    } else {
      Deno.env.set("AI_TEXT_MODEL", originalEnv);
    }
  }
});

// =============================================================================
// getAvailableUsageTypes
// =============================================================================

Deno.test("getAvailableUsageTypes - includes new usage types", () => {
  const types = getAvailableUsageTypes();
  assertEquals(types.includes("recipe_creation"), true);
  assertEquals(types.includes("recipe_formatting"), true);
  assertEquals(types.includes("text"), true);
  assertEquals(types.includes("embedding"), true);
});

Deno.test("getAvailableUsageTypes - all types have valid configs", () => {
  const types = getAvailableUsageTypes();
  for (const type of types) {
    const config = getProviderConfig(type);
    assertExists(config.provider);
    assertExists(config.model);
    assertExists(config.apiKeyEnvVar);
  }
});
