/**
 * Tool Registry Parity and Contract Tests
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

Deno.test("tool registry: has retrieve_cooked_recipes registered", () => {
  const reg = getToolRegistration("retrieve_cooked_recipes");
  assertNotEquals(reg, undefined);
  assertEquals(reg!.aiTool.name, "retrieve_cooked_recipes");
});

Deno.test("tool registry: old retrieve_custom_recipe is removed", () => {
  const reg = getToolRegistration("retrieve_custom_recipe");
  assertEquals(reg, undefined);
});

Deno.test("tool registry: unknown tool returns undefined", () => {
  const reg = getToolRegistration("nonexistent_tool");
  assertEquals(reg, undefined);
});

Deno.test("tool registry: all tools have name, description, parameters", () => {
  const tools = getRegisteredAiTools();
  for (const tool of tools) {
    assertNotEquals(tool.name, undefined, "Tool missing name");
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

Deno.test("voice tools: all voice-allowed tools are in the registry", () => {
  const voiceNames = getAllowedVoiceToolNames();
  for (const name of voiceNames) {
    const reg = getToolRegistration(name);
    assertNotEquals(reg, undefined, `Voice tool ${name} not in registry`);
  }
});

Deno.test("voice tools: required tools are voice-allowed", () => {
  const voiceNames = getAllowedVoiceToolNames();
  for (
    const name of [
      "search_recipes",
      "generate_custom_recipe",
      "modify_recipe",
      "retrieve_cooked_recipes",
    ]
  ) {
    assertEquals(voiceNames.includes(name), true);
  }
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

Deno.test("tool registry: has modify_recipe registered", () => {
  const reg = getToolRegistration("modify_recipe");
  assertNotEquals(reg, undefined);
  assertEquals(reg!.aiTool.name, "modify_recipe");
});

Deno.test("tool registry: modify_recipe is voice-allowed", () => {
  const reg = getToolRegistration("modify_recipe");
  assertEquals(reg!.allowedInVoice, true);
});

Deno.test("tool registry: modify_recipe shapeResult handles valid result", () => {
  const reg = getToolRegistration("modify_recipe")!;
  const shaped = reg.shapeResult({
    recipe: { suggestedName: "Modified Pasta" },
    safetyFlags: {},
  });
  assertEquals(shaped.customRecipe?.suggestedName, "Modified Pasta");
});

Deno.test("tool registry: modify_recipe shapeResult handles null", () => {
  const reg = getToolRegistration("modify_recipe")!;
  const shaped = reg.shapeResult(null);
  assertEquals(shaped.result, null);
});

Deno.test("tool registry: retrieve_cooked_recipes shapeResult handles valid array", () => {
  const reg = getToolRegistration("retrieve_cooked_recipes")!;
  const shaped = reg.shapeResult([
    {
      recipeId: "11111111-1111-4111-8111-111111111111",
      recipeTable: "recipes",
      name: "Test",
      totalTime: 10,
      difficulty: "easy",
      portions: 2,
    },
  ]);
  assertEquals(Array.isArray(shaped.recipes), true);
  assertEquals(shaped.recipes?.length, 1);
});

Deno.test("tool registry: retrieve_cooked_recipes shapeResult handles null", () => {
  const reg = getToolRegistration("retrieve_cooked_recipes")!;
  const shaped = reg.shapeResult(null);
  assertEquals(shaped.result, null);
});
