/**
 * Voice / Text Tool Parity Contract Tests
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

Deno.test("parity: every voice-allowed tool has identical aiTool schema in the registry", () => {
  const voiceNames = getAllowedVoiceToolNames();
  const allTools = getRegisteredAiTools();

  for (const name of voiceNames) {
    const reg = getToolRegistration(name);
    assertNotEquals(reg, undefined, `Voice tool ${name} not found in registry`);

    const fromAll = allTools.find((t) => t.name === name);
    assertNotEquals(
      fromAll,
      undefined,
      `${name} missing from getRegisteredAiTools()`,
    );

    assertEquals(
      JSON.stringify(reg!.aiTool),
      JSON.stringify(fromAll),
      `${name}: aiTool schema differs between registration and getRegisteredAiTools()`,
    );
  }
});

Deno.test("parity: shapeResult produces identical output for same input across voice-allowed tools", () => {
  const voiceNames = getAllowedVoiceToolNames();

  for (const name of voiceNames) {
    const reg = getToolRegistration(name)!;

    const shaped1 = reg.shapeResult(null);
    const shaped2 = reg.shapeResult(null);
    assertEquals(
      JSON.stringify(shaped1),
      JSON.stringify(shaped2),
      `${name}: shapeResult is not deterministic for null input`,
    );

    const shapedArr1 = reg.shapeResult([]);
    const shapedArr2 = reg.shapeResult([]);
    assertEquals(
      JSON.stringify(shapedArr1),
      JSON.stringify(shapedArr2),
      `${name}: shapeResult is not deterministic for empty array input`,
    );
  }
});

Deno.test("parity: voice tools include search_recipes, generate_custom_recipe, retrieve_cooked_recipes", () => {
  const voiceNames = getAllowedVoiceToolNames();

  const required = [
    "search_recipes",
    "generate_custom_recipe",
    "modify_recipe",
    "retrieve_cooked_recipes",
  ];

  for (const name of required) {
    assertEquals(
      voiceNames.includes(name),
      true,
      `Required voice tool ${name} is missing from getAllowedVoiceToolNames()`,
    );
  }
});

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

    const nullResult = reg!.shapeResult(null);
    assertNotEquals(
      nullResult,
      undefined,
      `${name}: shapeResult(null) returned undefined`,
    );
  }
});
