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
import {
  buildSystemPrompt,
  buildThermomixChatReference,
} from "../system-prompt.ts";

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

  assertStringIncludes(prompt, "TOOLS");
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
  const prompt = buildSystemPrompt(
    createUserContext({ locale: "es", localeChain: ["es", "en"] }),
  );

  assertStringIncludes(prompt, "food and cooking related");
});

Deno.test("buildSystemPrompt places personality BEFORE rules", () => {
  const prompt = buildSystemPrompt(
    createUserContext({ locale: "en", localeChain: ["en"] }),
  );

  const personalityIndex = prompt.indexOf("IDENTITY:");
  const toolsIndex = prompt.indexOf("TOOLS");
  assertEquals(
    personalityIndex < toolsIndex,
    true,
    "Personality should appear before TOOLS",
  );
});

Deno.test("buildSystemPrompt includes shared personality block for EN", () => {
  const prompt = buildSystemPrompt(
    createUserContext({ locale: "en", localeChain: ["en"] }),
  );

  assertStringIncludes(prompt, "IDENTITY:");
  assertStringIncludes(prompt, "cooking companion from YummyYummix");
  assertStringIncludes(prompt, "make cooking feel easy, achievable, and fun");
  assertEquals(prompt.includes("IDENTIDAD:"), false);
});

Deno.test("buildSystemPrompt includes shared personality block for ES", () => {
  const prompt = buildSystemPrompt(
    createUserContext({ locale: "es", localeChain: ["es", "en"] }),
  );

  assertStringIncludes(prompt, "IDENTIDAD:");
  assertStringIncludes(prompt, "compañera de cocina de YummyYummix");
  assertStringIncludes(prompt, "vocabulario de Mexican Spanish");
  assertEquals(prompt.includes("IDENTITY:"), false);
});

Deno.test("buildSystemPrompt separates communication and tool sections", () => {
  const prompt = buildSystemPrompt(createUserContext());

  assertStringIncludes(prompt, "COMMUNICATION:");
  assertStringIncludes(prompt, "TOOLS");
  // No old monolithic RULES section (standalone header, not part of "TOOLS — CRITICAL RULES:")
  assertEquals(prompt.includes("\nRULES:\n"), false);
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

Deno.test("buildSystemPrompt includes FORMATTING section", () => {
  const prompt = buildSystemPrompt(createUserContext());
  assertStringIncludes(prompt, "FORMATTING:");
  assertStringIncludes(prompt, "**bold**");
});

Deno.test("buildSystemPrompt includes scannable communication rule", () => {
  const prompt = buildSystemPrompt(createUserContext());
  assertStringIncludes(prompt, "scannable");
});

Deno.test("buildSystemPrompt with Thermomix includes quick reference", () => {
  const prompt = buildSystemPrompt(
    createUserContext({ kitchenEquipment: ["thermomix_TM6"] }),
  );
  assertStringIncludes(prompt, "THERMOMIX QUICK REFERENCE");
  assertStringIncludes(prompt, "Varoma is a STEAM MODE");
});

Deno.test("buildSystemPrompt without Thermomix excludes quick reference", () => {
  const prompt = buildSystemPrompt(
    createUserContext({ kitchenEquipment: [] }),
  );
  assertEquals(prompt.includes("THERMOMIX QUICK REFERENCE"), false);
});

Deno.test("buildSystemPrompt with TM7 includes Open Cooking", () => {
  const prompt = buildSystemPrompt(
    createUserContext({ kitchenEquipment: ["thermomix_TM7"] }),
  );
  assertStringIncludes(prompt, "Open Cooking (TM7 only)");
});

Deno.test("buildSystemPrompt with TM6 excludes Open Cooking", () => {
  const prompt = buildSystemPrompt(
    createUserContext({ kitchenEquipment: ["thermomix_TM6"] }),
  );
  assertEquals(prompt.includes("Open Cooking (TM7 only)"), false);
});

// ============================================================
// Workstream A1: Thermomix cooking mode corrections
// ============================================================

Deno.test("buildThermomixChatReference browning section mentions blade ROTATES", () => {
  const ref = buildThermomixChatReference(["TM7"]);
  assertStringIncludes(ref, "Blade ROTATES");
});

Deno.test("buildThermomixChatReference Open Cooking says no blade rotation", () => {
  const ref = buildThermomixChatReference(["TM7"]);
  assertStringIncludes(ref, "No blade rotation");
  assertStringIncludes(ref, "dedicated cooking mode");
});

Deno.test("buildThermomixChatReference includes delicate items warning", () => {
  const ref = buildThermomixChatReference(["TM6"]);
  assertStringIncludes(ref, "Delicate formed items");
  assertStringIncludes(ref, "NEVER brown in the Thermomix bowl");
  assertStringIncludes(ref, "blade rotation destroys them");
});

Deno.test("buildThermomixChatReference includes conversational tone instruction", () => {
  const ref = buildThermomixChatReference(["TM6"]);
  assertStringIncludes(ref, "write conversationally");
  assertStringIncludes(ref, "never copy it verbatim");
});

// ============================================================
// Workstream A3: Cooking helper mode
// ============================================================

Deno.test("buildSystemPrompt includes cooking helper mode when cookingContext provided", () => {
  const prompt = buildSystemPrompt(
    createUserContext(),
    undefined,
    {
      recipeTitle: "Chicken Soup",
      currentStep: "Step 3",
      stepInstructions: "Add the vegetables and simmer for 20 minutes.",
    },
  );

  assertStringIncludes(prompt, "COOKING HELPER MODE:");
  assertStringIncludes(prompt, '"Chicken Soup"');
  assertStringIncludes(prompt, "Step 3");
  assertStringIncludes(prompt, "Add the vegetables and simmer for 20 minutes.");
  assertStringIncludes(prompt, "Do NOT generate new recipes");
  assertStringIncludes(prompt, "shorter answers");
});

Deno.test("buildSystemPrompt excludes cooking helper mode when no cookingContext", () => {
  const prompt = buildSystemPrompt(createUserContext());

  assertEquals(prompt.includes("COOKING HELPER MODE"), false);
});

Deno.test("buildSystemPrompt cooking helper mode works without stepInstructions", () => {
  const prompt = buildSystemPrompt(
    createUserContext(),
    undefined,
    {
      recipeTitle: "Pasta Carbonara",
      currentStep: "Step 1",
    },
  );

  assertStringIncludes(prompt, "COOKING HELPER MODE:");
  assertStringIncludes(prompt, '"Pasta Carbonara"');
  assertStringIncludes(prompt, "Step 1");
  assertEquals(prompt.includes("Current step instructions:"), false);
});
