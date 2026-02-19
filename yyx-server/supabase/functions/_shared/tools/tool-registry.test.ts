/**
 * Tool Registry Parity and Contract Tests
 *
 * Verifies that all registered tools have consistent definitions
 * and that voice-allowed tools are properly configured.
 */

import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  getAllowedVoiceToolNames,
  getRegisteredAiTools,
  getToolRegistration,
} from "./tool-registry.ts";

// ============================================================
// Registry completeness
// ============================================================

Deno.test("tool registry: has search_recipes registered", () => {
  const reg = getToolRegistration("search_recipes");
  assertNotEquals(reg, undefined);
  assertEquals(reg!.aiTool.name, "search_recipes");
});

Deno.test("tool registry: has generate_custom_recipe registered", () => {
  const reg = getToolRegistration("generate_custom_recipe");
  assertNotEquals(reg, undefined);
  assertEquals(reg!.aiTool.name, "generate_custom_recipe");
});

Deno.test("tool registry: has retrieve_custom_recipe registered", () => {
  const reg = getToolRegistration("retrieve_custom_recipe");
  assertNotEquals(reg, undefined);
  assertEquals(reg!.aiTool.name, "retrieve_custom_recipe");
});

Deno.test("tool registry: has app_action registered", () => {
  const reg = getToolRegistration("app_action");
  assertNotEquals(reg, undefined);
  assertEquals(reg!.aiTool.name, "app_action");
});

Deno.test("tool registry: unknown tool returns undefined", () => {
  const reg = getToolRegistration("nonexistent_tool");
  assertEquals(reg, undefined);
});

// ============================================================
// AI tool definition contract
// ============================================================

Deno.test("tool registry: all tools have name, description, parameters", () => {
  const tools = getRegisteredAiTools();
  for (const tool of tools) {
    assertNotEquals(tool.name, undefined, `Tool missing name`);
    assertNotEquals(
      tool.description,
      undefined,
      `${tool.name} missing description`,
    );
    assertNotEquals(
      tool.parameters,
      undefined,
      `${tool.name} missing parameters`,
    );
  }
});

Deno.test("tool registry: all tools have non-empty descriptions", () => {
  const tools = getRegisteredAiTools();
  for (const tool of tools) {
    assertEquals(typeof tool.description, "string");
    assertEquals(
      tool.description!.length > 0,
      true,
      `${tool.name} has empty description`,
    );
  }
});

// ============================================================
// Voice/text parity
// ============================================================

Deno.test("voice tools: all voice-allowed tools are in the registry", () => {
  const voiceNames = getAllowedVoiceToolNames();
  for (const name of voiceNames) {
    const reg = getToolRegistration(name);
    assertNotEquals(reg, undefined, `Voice tool ${name} not in registry`);
  }
});

Deno.test("voice tools: search_recipes is voice-allowed", () => {
  const voiceNames = getAllowedVoiceToolNames();
  assertEquals(voiceNames.includes("search_recipes"), true);
});

Deno.test("voice tools: generate_custom_recipe is voice-allowed", () => {
  const voiceNames = getAllowedVoiceToolNames();
  assertEquals(voiceNames.includes("generate_custom_recipe"), true);
});

Deno.test("voice tools: retrieve_custom_recipe is voice-allowed", () => {
  const voiceNames = getAllowedVoiceToolNames();
  assertEquals(voiceNames.includes("retrieve_custom_recipe"), true);
});

Deno.test("voice tools: app_action is voice-allowed", () => {
  const voiceNames = getAllowedVoiceToolNames();
  assertEquals(voiceNames.includes("app_action"), true);
});

Deno.test("voice tools: all registered tools have execute and shapeResult", () => {
  const voiceNames = getAllowedVoiceToolNames();
  for (const name of voiceNames) {
    const reg = getToolRegistration(name);
    assertEquals(typeof reg!.execute, "function", `${name} missing execute`);
    assertEquals(
      typeof reg!.shapeResult,
      "function",
      `${name} missing shapeResult`,
    );
  }
});

// ============================================================
// Shape result contract
// ============================================================

Deno.test("tool registry: search_recipes shapeResult handles array", () => {
  const reg = getToolRegistration("search_recipes")!;
  const shaped = reg.shapeResult([]);
  assertEquals(shaped.recipes, []);
});

Deno.test("tool registry: search_recipes shapeResult handles non-array", () => {
  const reg = getToolRegistration("search_recipes")!;
  const shaped = reg.shapeResult("unexpected");
  assertEquals(shaped.result, "unexpected");
});

Deno.test("tool registry: generate_custom_recipe shapeResult handles valid result", () => {
  const reg = getToolRegistration("generate_custom_recipe")!;
  const shaped = reg.shapeResult({
    recipe: { suggestedName: "Test" },
    safetyFlags: {},
  });
  assertEquals(shaped.customRecipe?.suggestedName, "Test");
});

Deno.test("tool registry: generate_custom_recipe shapeResult handles null", () => {
  const reg = getToolRegistration("generate_custom_recipe")!;
  const shaped = reg.shapeResult(null);
  assertEquals(shaped.result, null);
});

Deno.test("tool registry: retrieve_custom_recipe shapeResult handles valid result", () => {
  const reg = getToolRegistration("retrieve_custom_recipe")!;
  const result = {
    version: "1.0",
    type: "single",
    recipe: {
      userRecipeId: "abc",
      name: "Test",
      createdAt: "2025-01-01",
      source: "ai_generated",
    },
    suggestions: [],
  };
  const shaped = reg.shapeResult(result);
  assertEquals(shaped.retrievalResult?.type, "single");
});

Deno.test("tool registry: retrieve_custom_recipe shapeResult handles null", () => {
  const reg = getToolRegistration("retrieve_custom_recipe")!;
  const shaped = reg.shapeResult(null);
  assertEquals(shaped.result, null);
});

Deno.test("tool registry: app_action shapeResult handles valid result", () => {
  const reg = getToolRegistration("app_action")!;
  const shaped = reg.shapeResult({ action: "share_recipe", params: {} });
  assertEquals(shaped.appAction?.action, "share_recipe");
});

Deno.test("tool registry: app_action shapeResult handles null", () => {
  const reg = getToolRegistration("app_action")!;
  const shaped = reg.shapeResult(null);
  assertEquals(shaped.result, null);
});

Deno.test("tool registry: app_action shapeResult handles non-object", () => {
  const reg = getToolRegistration("app_action")!;
  const shaped = reg.shapeResult("unexpected");
  assertEquals(shaped.result, "unexpected");
});
