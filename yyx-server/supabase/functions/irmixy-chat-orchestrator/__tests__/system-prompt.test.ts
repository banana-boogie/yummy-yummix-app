/**
 * System Prompt Tests
 *
 * Verifies text-only prompt behavior and meal context inclusion.
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

  assertEquals(prompt.includes("VOICE MODE"), false);
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
});

Deno.test("buildSystemPrompt includes scope guardrails section", () => {
  const prompt = buildSystemPrompt(createUserContext({ language: "es" }));

  assertStringIncludes(prompt, "SCOPE GUARDRAILS");
  assertStringIncludes(prompt, "cooking-only");
  assertStringIncludes(prompt, "Example EN");
  assertStringIncludes(prompt, "Example ES");
});
