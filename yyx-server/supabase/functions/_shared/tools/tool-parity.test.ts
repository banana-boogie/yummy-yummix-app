/**
 * Voice / Text Tool Parity Contract Tests
 *
 * Ensures voice and text orchestrators share identical tool definitions,
 * schemas, and shapeResult behaviour via the shared tool registry.
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
// Voice tool schema parity
// ============================================================

Deno.test("parity: every voice-allowed tool has identical aiTool schema in the registry", () => {
  const voiceNames = getAllowedVoiceToolNames();
  const allTools = getRegisteredAiTools();

  for (const name of voiceNames) {
    const reg = getToolRegistration(name);
    assertNotEquals(reg, undefined, `Voice tool ${name} not found in registry`);

    // The aiTool on the registration must be the same object present
    // in getRegisteredAiTools() — guaranteeing text and voice see the same schema.
    const fromAll = allTools.find((t) => t.name === name);
    assertNotEquals(fromAll, undefined, `${name} missing from getRegisteredAiTools()`);

    assertEquals(
      JSON.stringify(reg!.aiTool),
      JSON.stringify(fromAll),
      `${name}: aiTool schema differs between registration and getRegisteredAiTools()`,
    );
  }
});

// ============================================================
// shapeResult consistency
// ============================================================

Deno.test("parity: shapeResult produces identical output for same input across voice-allowed tools", () => {
  const voiceNames = getAllowedVoiceToolNames();

  for (const name of voiceNames) {
    const reg = getToolRegistration(name)!;

    // Null input — should be deterministic
    const shaped1 = reg.shapeResult(null);
    const shaped2 = reg.shapeResult(null);
    assertEquals(
      JSON.stringify(shaped1),
      JSON.stringify(shaped2),
      `${name}: shapeResult is not deterministic for null input`,
    );

    // Empty array input — should be deterministic
    const shapedArr1 = reg.shapeResult([]);
    const shapedArr2 = reg.shapeResult([]);
    assertEquals(
      JSON.stringify(shapedArr1),
      JSON.stringify(shapedArr2),
      `${name}: shapeResult is not deterministic for empty array input`,
    );
  }
});

// ============================================================
// Required voice tools present
// ============================================================

Deno.test("parity: voice tools include search_recipes, generate_custom_recipe, retrieve_custom_recipe", () => {
  const voiceNames = getAllowedVoiceToolNames();

  const required = [
    "search_recipes",
    "generate_custom_recipe",
    "retrieve_custom_recipe",
  ];

  for (const name of required) {
    assertEquals(
      voiceNames.includes(name),
      true,
      `Required voice tool ${name} is missing from getAllowedVoiceToolNames()`,
    );
  }
});

// ============================================================
// No voice tool without shapeResult
// ============================================================

Deno.test("parity: no voice-allowed tool lacks a shapeResult function", () => {
  const voiceNames = getAllowedVoiceToolNames();

  for (const name of voiceNames) {
    const reg = getToolRegistration(name);
    assertNotEquals(reg, undefined, `${name} not in registry`);
    assertEquals(
      typeof reg!.shapeResult,
      "function",
      `${name}: voice-allowed tool is missing shapeResult function`,
    );

    // Verify shapeResult doesn't throw on common input shapes
    const nullResult = reg!.shapeResult(null);
    assertNotEquals(nullResult, undefined, `${name}: shapeResult(null) returned undefined`);
  }
});
