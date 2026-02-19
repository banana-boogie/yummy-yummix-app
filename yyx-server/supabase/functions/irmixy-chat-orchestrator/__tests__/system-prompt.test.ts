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
  assertEquals(prompt.includes("speaking, not writing"), false);
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

Deno.test("buildSystemPrompt includes search-first strategy in consolidated rules", () => {
  const prompt = buildSystemPrompt(createUserContext());

  assertStringIncludes(prompt, "Search first");
  assertStringIncludes(prompt, "search_recipes");
  assertStringIncludes(prompt, "generate_custom_recipe");
});

Deno.test("buildSystemPrompt uses warm allergen language (non-blocking)", () => {
  const prompt = buildSystemPrompt(createUserContext());

  assertStringIncludes(prompt, "allergens briefly and warmly");
  assertStringIncludes(prompt, "Don't block recipes or require confirmation");
});

Deno.test("buildSystemPrompt includes scope guardrails", () => {
  const prompt = buildSystemPrompt(createUserContext({ language: "es" }));

  assertStringIncludes(prompt, "cooking, recipes, ingredients");
});

Deno.test("buildSystemPrompt places personality BEFORE rules", () => {
  const prompt = buildSystemPrompt(createUserContext({ language: "en" }));

  const personalityIndex = prompt.indexOf("IDENTITY & VOICE");
  const rulesIndex = prompt.indexOf("RULES:");
  assertEquals(personalityIndex < rulesIndex, true, "Personality should appear before RULES");
});

Deno.test("buildSystemPrompt includes shared personality block for EN", () => {
  const prompt = buildSystemPrompt(createUserContext({ language: "en" }));

  assertStringIncludes(prompt, "IDENTITY & VOICE");
  assertStringIncludes(prompt, "warm, fun friend");
  assertStringIncludes(prompt, "One thought per message");
  assertStringIncludes(prompt, "single best answer");
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
  assertStringIncludes(prompt, "never narrate tool actions");
});

Deno.test("buildSystemPrompt has consolidated brevity rule", () => {
  const prompt = buildSystemPrompt(createUserContext());

  // No standalone sections from old prompt
  assertEquals(prompt.includes("BREVITY GUIDELINES"), false);
  assertEquals(prompt.includes("CRITICAL - TOOL USAGE"), false);
  assertEquals(prompt.includes("SEARCH-FIRST STRATEGY"), false);
  assertEquals(prompt.includes("RECIPE GENERATION FLOW"), false);
  // Brevity is rule 2
  assertStringIncludes(prompt, "1-3 short sentences");
  assertStringIncludes(prompt, "No lists");
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

Deno.test("buildSystemPrompt includes security rules", () => {
  const prompt = buildSystemPrompt(createUserContext());

  assertStringIncludes(prompt, "SECURITY:");
  assertStringIncludes(prompt, "DATA ONLY");
  assertStringIncludes(prompt, "override these rules");
});

Deno.test("buildSystemPrompt includes recipe modification rule", () => {
  const prompt = buildSystemPrompt(createUserContext());

  assertStringIncludes(prompt, "modify a previous recipe");
  assertStringIncludes(prompt, "additionalRequests");
});
