/**
 * System Prompt Tests
 *
 * Verifies text-only prompt behavior, meal context inclusion,
 * and correct use of shared building blocks.
 */

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import type { UserContext } from "../../_shared/irmixy-schemas.ts";
import { buildSystemPrompt } from "../system-prompt.ts";

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

Deno.test("buildSystemPrompt is text-only and never adds voice instructions", () => {
  const prompt = buildSystemPrompt(createUserContext());

  assertEquals(prompt.includes("VOICE RULES"), false);
  assertStringIncludes(prompt, "CRITICAL - TOOL USAGE");
});

Deno.test("buildSystemPrompt includes meal context section when detected", () => {
  const prompt = buildSystemPrompt(createUserContext(), {
    mealType: "dinner",
    timePreference: "quick",
  });

  assertStringIncludes(prompt, "## MEAL CONTEXT");
  assertStringIncludes(prompt, "DINNER");
  assertStringIncludes(prompt, "Time constraint: quick");
});

Deno.test("buildSystemPrompt includes search-first strategy guidance", () => {
  const prompt = buildSystemPrompt(createUserContext());

  assertStringIncludes(prompt, "SEARCH-FIRST STRATEGY");
  assertStringIncludes(prompt, "call search_recipes FIRST");
  assertStringIncludes(prompt, "named or known dish");
  assertStringIncludes(prompt, "broad discovery");
  assertStringIncludes(prompt, "something sweet/light/quick/healthy");
});

Deno.test("buildSystemPrompt uses warm allergen language (non-blocking)", () => {
  const prompt = buildSystemPrompt(createUserContext());

  assertStringIncludes(prompt, "mention it briefly and warmly");
  assertStringIncludes(prompt, "Do not block the recipe or require confirmation");
});

Deno.test("buildSystemPrompt includes scope guardrails section", () => {
  const prompt = buildSystemPrompt(createUserContext({ language: "es" }));

  assertStringIncludes(prompt, "SCOPE GUARDRAILS");
  assertStringIncludes(prompt, "cooking-only");
});

Deno.test("buildSystemPrompt includes shared personality block for EN", () => {
  const prompt = buildSystemPrompt(createUserContext({ language: "en" }));

  assertStringIncludes(prompt, "IDENTITY & VOICE");
  assertStringIncludes(prompt, "warm, fun friend");
  assertEquals(prompt.includes("IDENTIDAD Y VOZ"), false);
});

Deno.test("buildSystemPrompt includes shared personality block for ES", () => {
  const prompt = buildSystemPrompt(createUserContext({ language: "es" }));

  assertStringIncludes(prompt, "IDENTIDAD Y VOZ");
  assertStringIncludes(prompt, "amiga cálida y divertida");
  assertStringIncludes(prompt, "vocabulario mexicano");
  assertEquals(prompt.includes("IDENTITY & VOICE"), false);
});

Deno.test("buildSystemPrompt includes anti-narration guardrail", () => {
  const prompt = buildSystemPrompt(createUserContext());
  assertStringIncludes(prompt, "NEVER reference internal tool names");
});

Deno.test("buildSystemPrompt includes user context XML block", () => {
  const prompt = buildSystemPrompt(
    createUserContext({
      kitchenEquipment: ["Thermomix"],
      dietTypes: ["vegetarian"],
      customAllergies: ["peanuts"],
    }),
  );

  assertStringIncludes(prompt, "<user_context>");
  assertStringIncludes(prompt, "<kitchen_equipment>");
  assertStringIncludes(prompt, "- Thermomix");
  assertStringIncludes(prompt, "- vegetarian");
  assertStringIncludes(prompt, "- peanuts");
});
