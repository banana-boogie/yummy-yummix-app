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

Deno.test("buildSystemPrompt includes tool rules with search-first strategy", () => {
  const prompt = buildSystemPrompt(createUserContext());

  assertStringIncludes(prompt, "TOOLS:");
  assertStringIncludes(prompt, "Search first");
  assertStringIncludes(prompt, "search_recipes");
  assertStringIncludes(prompt, "generate_custom_recipe");
  assertStringIncludes(prompt, "modify_recipe");
});

Deno.test("buildSystemPrompt uses warm allergen language (non-blocking)", () => {
  const prompt = buildSystemPrompt(createUserContext());

  assertStringIncludes(prompt, "allergens briefly and warmly");
  assertStringIncludes(prompt, "Don't block recipes or ask for confirmation");
});

Deno.test("buildSystemPrompt includes scope guardrails", () => {
  const prompt = buildSystemPrompt(createUserContext({ language: "es" }));

  assertStringIncludes(prompt, "food and cooking related");
});

Deno.test("buildSystemPrompt places personality BEFORE rules", () => {
  const prompt = buildSystemPrompt(createUserContext({ language: "en" }));

  const personalityIndex = prompt.indexOf("IDENTITY:");
  const toolsIndex = prompt.indexOf("TOOLS:");
  assertEquals(
    personalityIndex < toolsIndex,
    true,
    "Personality should appear before TOOLS",
  );
});

Deno.test("buildSystemPrompt includes shared personality block for EN", () => {
  const prompt = buildSystemPrompt(createUserContext({ language: "en" }));

  assertStringIncludes(prompt, "IDENTITY:");
  assertStringIncludes(prompt, "cooking companion from YummyYummix");
  assertStringIncludes(prompt, "make cooking feel easy, achievable, and fun");
  assertEquals(prompt.includes("IDENTIDAD:"), false);
});

Deno.test("buildSystemPrompt includes shared personality block for ES", () => {
  const prompt = buildSystemPrompt(createUserContext({ language: "es" }));

  assertStringIncludes(prompt, "IDENTIDAD:");
  assertStringIncludes(prompt, "compañera de cocina de YummyYummix");
  assertStringIncludes(prompt, "vocabulario mexicano por defecto");
  assertEquals(prompt.includes("IDENTITY:"), false);
});

Deno.test("buildSystemPrompt separates communication and tool sections", () => {
  const prompt = buildSystemPrompt(createUserContext());

  assertStringIncludes(prompt, "COMMUNICATION:");
  assertStringIncludes(prompt, "TOOLS:");
  // No old monolithic RULES section
  assertEquals(prompt.includes("RULES:"), false);
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

Deno.test("buildSystemPrompt routes modifications to modify_recipe", () => {
  const prompt = buildSystemPrompt(createUserContext());

  assertStringIncludes(prompt, "modify_recipe");
  assertStringIncludes(prompt, "change a recipe that Irmixy created");
});
