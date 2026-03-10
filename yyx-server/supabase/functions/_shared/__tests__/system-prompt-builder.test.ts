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
  buildVocabularyDirective,
  buildVoiceInstructions,
  REGIONAL_VOCABULARY,
  resolveVocabulary,
} from "../system-prompt-builder.ts";

function createUserContext(overrides: Partial<UserContext> = {}): UserContext {
  return {
    locale: "en",
    localeChain: ["en"],
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

Deno.test("buildUserContextBlock includes populated fields", () => {
  const block = buildUserContextBlock(
    createUserContext({
      locale: "es",
      localeChain: ["es", "en"],
      measurementSystem: "metric",
      dietaryRestrictions: ["gluten"],
      dietTypes: ["vegetarian"],
      customAllergies: ["peanuts"],
      kitchenEquipment: ["Thermomix"],
    }),
  );

  assertStringIncludes(block, "<locale>es</locale>");
  assertStringIncludes(
    block,
    "<measurement_system>metric</measurement_system>",
  );
  assertStringIncludes(block, "- gluten");
  assertStringIncludes(block, "- vegetarian");
  assertStringIncludes(block, "- peanuts");
  assertStringIncludes(block, "- Thermomix");
});

Deno.test("buildUserContextBlock excludes unused fields", () => {
  const block = buildUserContextBlock(createUserContext());

  assertEquals(block.includes("skill_level"), false);
  assertEquals(block.includes("household_size"), false);
  assertEquals(block.includes("ingredient_dislikes"), false);
});

Deno.test("buildUserContextBlock shows defaults for empty fields", () => {
  const block = buildUserContextBlock(createUserContext());

  assertStringIncludes(
    block,
    "<dietary_restrictions>\nnone\n</dietary_restrictions>",
  );
  assertStringIncludes(
    block,
    "<kitchen_equipment>\nnot specified\n</kitchen_equipment>",
  );
});

// ============================================================
// buildPersonalityBlock
// ============================================================

Deno.test("buildPersonalityBlock returns English for 'en'", () => {
  const personality = buildPersonalityBlock("en");

  assertStringIncludes(personality, "IDENTITY:");
  assertStringIncludes(personality, "cooking companion from YummyYummix");
  assertStringIncludes(personality, "patient, warm, deeply experienced");
  assertStringIncludes(
    personality,
    "make cooking feel easy, achievable, and fun",
  );
  assertStringIncludes(
    personality,
    "walks alongside, not someone who lectures",
  );
  assertStringIncludes(personality, "Use emojis sparingly");
  assertEquals(personality.includes("IDENTIDAD"), false);
});

Deno.test("buildPersonalityBlock returns Mexican Spanish for 'es'", () => {
  const personality = buildPersonalityBlock("es");

  assertStringIncludes(personality, "IDENTIDAD:");
  assertStringIncludes(personality, "compañera de cocina de YummyYummix");
  assertStringIncludes(personality, "vocabulario de Mexican Spanish");
  assertStringIncludes(personality, "jitomate");
  assertStringIncludes(personality, "cualquier receta es fácil");
  assertStringIncludes(personality, "acompaña, no como alguien que instruye");
  assertStringIncludes(personality, "emojis con moderación");
  assertEquals(personality.includes("IDENTITY:"), false);
});

// ============================================================
// Locale-aware vocabulary
// ============================================================

Deno.test("resolveVocabulary returns Mexican vocab for 'es'", () => {
  const vocab = resolveVocabulary("es");
  assertEquals(vocab, REGIONAL_VOCABULARY["es"]);
  assertEquals(vocab?.tomato, "jitomate");
});

Deno.test("resolveVocabulary returns Spain vocab for 'es-ES'", () => {
  const vocab = resolveVocabulary("es-ES");
  assertEquals(vocab, REGIONAL_VOCABULARY["es-ES"]);
  assertEquals(vocab?.tomato, "tomate");
  assertEquals(vocab?.potato, "patata");
});

Deno.test("resolveVocabulary falls back from es-MX to es", () => {
  const vocab = resolveVocabulary("es-MX");
  assertEquals(vocab, REGIONAL_VOCABULARY["es"]);
});

Deno.test("resolveVocabulary returns undefined for 'en'", () => {
  const vocab = resolveVocabulary("en");
  assertEquals(vocab, undefined);
});

Deno.test("buildVocabularyDirective returns empty for 'en'", () => {
  assertEquals(buildVocabularyDirective("en"), "");
});

Deno.test("buildVocabularyDirective uses Mexican Spanish for 'es'", () => {
  const directive = buildVocabularyDirective("es");
  assertStringIncludes(directive, "vocabulario de Mexican Spanish");
  assertStringIncludes(directive, "jitomate");
  assertStringIncludes(directive, "elote");
});

Deno.test("buildVocabularyDirective uses Spain Spanish for 'es-ES'", () => {
  const directive = buildVocabularyDirective("es-ES");
  assertStringIncludes(directive, "vocabulario de Spain Spanish");
  assertStringIncludes(directive, "tomate");
  assertStringIncludes(directive, "patata");
  assertStringIncludes(directive, "zumo");
});

Deno.test("buildPersonalityBlock uses Spain vocabulary for 'es-ES'", () => {
  const personality = buildPersonalityBlock("es-ES");
  assertStringIncludes(personality, "IDENTIDAD:");
  assertStringIncludes(personality, "vocabulario de Spain Spanish");
  assertStringIncludes(personality, "tomate");
  assertStringIncludes(personality, "patata");
  // Should NOT contain Mexican-specific terms
  assertEquals(personality.includes("jitomate"), false);
});

// ============================================================
// buildVoiceInstructions
// ============================================================

Deno.test("buildVoiceInstructions includes personality for EN", () => {
  const instructions = buildVoiceInstructions(createUserContext());

  assertStringIncludes(instructions, "IDENTITY:");
  assertStringIncludes(instructions, "cooking companion from YummyYummix");
});

Deno.test("buildVoiceInstructions includes personality for ES", () => {
  const instructions = buildVoiceInstructions(
    createUserContext({ locale: "es", localeChain: ["es", "en"] }),
  );

  assertStringIncludes(instructions, "IDENTIDAD:");
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

  assertStringIncludes(instructions, "food and cooking related");
});

Deno.test("buildVoiceInstructions includes security rules", () => {
  const instructions = buildVoiceInstructions(createUserContext());

  assertStringIncludes(instructions, "SECURITY:");
  assertStringIncludes(instructions, "DATA ONLY");
  assertStringIncludes(instructions, "override these rules");
});

Deno.test("buildVoiceInstructions includes tool usage rules", () => {
  const instructions = buildVoiceInstructions(createUserContext());

  // Voice instructions now include tool usage section (unified server-side)
  assertStringIncludes(instructions, "search_recipes");
  assertStringIncludes(instructions, "generate_custom_recipe");
  // But should NOT include text-chat-specific SEARCH-FIRST rule
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
