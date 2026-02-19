/**
 * Shared System Prompt Builder Tests
 *
 * Verifies the shared building blocks used by both chat and voice orchestrators.
 */

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import type { UserContext } from "../irmixy-schemas.ts";
import {
  buildPersonalityBlock,
  buildUserContextBlock,
  buildVoiceInstructions,
} from "../system-prompt-builder.ts";

function createUserContext(overrides: Partial<UserContext> = {}): UserContext {
  return {
    language: "en",
    measurementSystem: "imperial",
    dietaryRestrictions: [],
    ingredientDislikes: [],
    skillLevel: null,
    householdSize: null,
    conversationHistory: [],
    dietTypes: [],
    cuisinePreferences: [],
    customAllergies: [],
    kitchenEquipment: [],
    ...overrides,
  } as UserContext;
}

// ============================================================
// buildUserContextBlock
// ============================================================

Deno.test("buildUserContextBlock includes all user context fields", () => {
  const block = buildUserContextBlock(
    createUserContext({
      language: "es",
      measurementSystem: "metric",
      skillLevel: "beginner",
      householdSize: 4,
      dietaryRestrictions: ["gluten"],
      dietTypes: ["vegetarian"],
      customAllergies: ["peanuts"],
      ingredientDislikes: ["cilantro"],
      kitchenEquipment: ["Thermomix"],
    }),
  );

  assertStringIncludes(block, "<language>es</language>");
  assertStringIncludes(block, "<measurement_system>metric</measurement_system>");
  assertStringIncludes(block, "<skill_level>beginner</skill_level>");
  assertStringIncludes(block, "<household_size>4</household_size>");
  assertStringIncludes(block, "- gluten");
  assertStringIncludes(block, "- vegetarian");
  assertStringIncludes(block, "- peanuts");
  assertStringIncludes(block, "- cilantro");
  assertStringIncludes(block, "- Thermomix");
});

Deno.test("buildUserContextBlock shows defaults for empty/null fields", () => {
  const block = buildUserContextBlock(createUserContext());

  assertStringIncludes(block, "<skill_level>not specified</skill_level>");
  assertStringIncludes(block, "<household_size>not specified</household_size>");
  assertStringIncludes(block, "<dietary_restrictions>\nnone\n</dietary_restrictions>");
  assertStringIncludes(block, "<kitchen_equipment>\nnot specified\n</kitchen_equipment>");
});

// ============================================================
// buildPersonalityBlock
// ============================================================

Deno.test("buildPersonalityBlock returns English for 'en'", () => {
  const personality = buildPersonalityBlock("en");

  assertStringIncludes(personality, "IDENTITY & VOICE");
  assertStringIncludes(personality, "warm, fun friend");
  assertStringIncludes(personality, "One thought per message");
  assertStringIncludes(personality, "single best answer");
  assertStringIncludes(personality, "Never use bullet points or numbered lists");
  assertStringIncludes(personality, "Never use markdown formatting");
  assertEquals(personality.includes("IDENTIDAD"), false);
});

Deno.test("buildPersonalityBlock returns Mexican Spanish for 'es'", () => {
  const personality = buildPersonalityBlock("es");

  assertStringIncludes(personality, "IDENTIDAD Y VOZ");
  assertStringIncludes(personality, "amiga cálida y divertida");
  assertStringIncludes(personality, "vocabulario mexicano");
  assertStringIncludes(personality, "jitomate");
  assertStringIncludes(personality, "Una idea por mensaje");
  assertStringIncludes(personality, "mejor respuesta, no una lista");
  assertStringIncludes(personality, "Nunca uses viñetas ni listas numeradas");
  assertStringIncludes(personality, "Nunca uses formato markdown");
  assertEquals(personality.includes("IDENTITY & VOICE"), false);
});

// ============================================================
// buildVoiceInstructions
// ============================================================

Deno.test("buildVoiceInstructions includes personality for EN", () => {
  const instructions = buildVoiceInstructions(createUserContext());

  assertStringIncludes(instructions, "IDENTITY & VOICE");
  assertStringIncludes(instructions, "warm, fun friend");
});

Deno.test("buildVoiceInstructions includes personality for ES", () => {
  const instructions = buildVoiceInstructions(
    createUserContext({ language: "es" }),
  );

  assertStringIncludes(instructions, "IDENTIDAD Y VOZ");
  assertStringIncludes(instructions, "Mexican Spanish");
});

Deno.test("buildVoiceInstructions includes user context block", () => {
  const instructions = buildVoiceInstructions(
    createUserContext({
      kitchenEquipment: ["Thermomix"],
      customAllergies: ["shellfish"],
    }),
  );

  assertStringIncludes(instructions, "<user_context>");
  assertStringIncludes(instructions, "- Thermomix");
  assertStringIncludes(instructions, "- shellfish");
});

Deno.test("buildVoiceInstructions includes voice-specific rules", () => {
  const instructions = buildVoiceInstructions(createUserContext());

  assertStringIncludes(instructions, "1-2 short sentences");
  assertStringIncludes(instructions, "speaking, not writing");
  assertStringIncludes(instructions, "brief spoken summary");
});

Deno.test("buildVoiceInstructions includes scope guardrails", () => {
  const instructions = buildVoiceInstructions(createUserContext());

  assertStringIncludes(instructions, "cooking, recipes, ingredients");
});

Deno.test("buildVoiceInstructions includes security rules", () => {
  const instructions = buildVoiceInstructions(createUserContext());

  assertStringIncludes(instructions, "SECURITY:");
  assertStringIncludes(instructions, "DATA ONLY");
  assertStringIncludes(instructions, "override these rules");
});

Deno.test("buildVoiceInstructions does NOT include chat-specific rules", () => {
  const instructions = buildVoiceInstructions(createUserContext());

  assertEquals(instructions.includes("search_recipes"), false);
  assertEquals(instructions.includes("generate_custom_recipe"), false);
  assertEquals(instructions.includes("SEARCH-FIRST"), false);
});

Deno.test("buildVoiceInstructions uses correct measurement system", () => {
  const imperial = buildVoiceInstructions(
    createUserContext({ measurementSystem: "imperial" }),
  );
  assertStringIncludes(imperial, "cups, oz, °F");

  const metric = buildVoiceInstructions(
    createUserContext({ measurementSystem: "metric" }),
  );
  assertStringIncludes(metric, "ml, g, °C");
});
