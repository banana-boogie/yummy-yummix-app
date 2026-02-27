/**
 * Modify Recipe Tool Tests
 *
 * Tests extraction from history, validation, system prompt building,
 * and modification prompt construction.
 */

import {
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import type { GeneratedRecipe, UserContext } from "../irmixy-schemas.ts";
import {
  buildModificationPrompt,
  extractLastRecipeFromHistory,
  getModificationSystemPrompt,
} from "./modify-recipe.ts";
import { validateModifyRecipeParams } from "./tool-validators.ts";
import { ToolValidationError } from "./tool-validators.ts";

// ============================================================
// Test Fixtures
// ============================================================

function createMinimalRecipe(
  overrides: Partial<GeneratedRecipe> = {},
): GeneratedRecipe {
  return {
    schemaVersion: "1.0",
    suggestedName: "Chicken Pasta",
    measurementSystem: "metric",
    language: "en",
    ingredients: [
      { name: "chicken", quantity: 500, unit: "g" },
      { name: "pasta", quantity: 250, unit: "g" },
    ],
    steps: [
      { order: 1, instruction: "Cook chicken", ingredientsUsed: ["chicken"] },
      { order: 2, instruction: "Boil pasta", ingredientsUsed: ["pasta"] },
    ],
    totalTime: 30,
    difficulty: "easy",
    portions: 4,
    tags: [],
    ...overrides,
  };
}

function createUserContext(overrides: Partial<UserContext> = {}): UserContext {
  return {
    language: "en",
    measurementSystem: "metric",
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
// extractLastRecipeFromHistory
// ============================================================

Deno.test("extractLastRecipeFromHistory: finds recipe in history", () => {
  const recipe = createMinimalRecipe();
  const history = [
    { role: "user", content: "Make me chicken pasta" },
    {
      role: "assistant",
      content: "Here's your recipe!",
      metadata: { customRecipe: recipe },
    },
  ];

  const result = extractLastRecipeFromHistory(history);
  assertEquals(result.suggestedName, "Chicken Pasta");
  assertEquals(result.portions, 4);
});

Deno.test("extractLastRecipeFromHistory: skips non-recipe messages", () => {
  const recipe = createMinimalRecipe();
  const history = [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there!" },
    { role: "user", content: "Make me chicken pasta" },
    {
      role: "assistant",
      content: "Here's your recipe!",
      metadata: { customRecipe: recipe },
    },
    { role: "user", content: "Thanks!" },
    { role: "assistant", content: "You're welcome!" },
  ];

  const result = extractLastRecipeFromHistory(history);
  assertEquals(result.suggestedName, "Chicken Pasta");
});

Deno.test("extractLastRecipeFromHistory: picks most recent recipe", () => {
  const recipe1 = createMinimalRecipe({ suggestedName: "Old Recipe" });
  const recipe2 = createMinimalRecipe({
    suggestedName: "New Recipe",
    portions: 6,
  });
  const history = [
    {
      role: "assistant",
      content: "First recipe",
      metadata: { customRecipe: recipe1 },
    },
    {
      role: "assistant",
      content: "Second recipe",
      metadata: { customRecipe: recipe2 },
    },
  ];

  const result = extractLastRecipeFromHistory(history);
  assertEquals(result.suggestedName, "New Recipe");
  assertEquals(result.portions, 6);
});

Deno.test("extractLastRecipeFromHistory: throws when no recipe found", () => {
  const history = [
    { role: "user", content: "Make it spicier" },
    { role: "assistant", content: "Sure!" },
  ];

  assertThrows(
    () => extractLastRecipeFromHistory(history),
    ToolValidationError,
    "No previously generated recipe found",
  );
});

Deno.test("extractLastRecipeFromHistory: throws for empty history", () => {
  assertThrows(
    () => extractLastRecipeFromHistory([]),
    ToolValidationError,
    "No previously generated recipe found",
  );
});

Deno.test("extractLastRecipeFromHistory: skips malformed recipe data", () => {
  const validRecipe = createMinimalRecipe();
  const history = [
    {
      role: "assistant",
      content: "Valid recipe",
      metadata: { customRecipe: validRecipe },
    },
    {
      role: "assistant",
      content: "Bad recipe",
      metadata: { customRecipe: { broken: true } },
    },
  ];

  // Should skip the malformed one and find the valid one
  const result = extractLastRecipeFromHistory(history);
  assertEquals(result.suggestedName, "Chicken Pasta");
});

// ============================================================
// validateModifyRecipeParams
// ============================================================

Deno.test("validateModifyRecipeParams: valid params", () => {
  const result = validateModifyRecipeParams({
    modificationRequest: "make it for 6 people",
  });
  assertEquals(result.modificationRequest, "make it for 6 people");
});

Deno.test("validateModifyRecipeParams: missing modificationRequest throws", () => {
  assertThrows(
    () => validateModifyRecipeParams({}),
    ToolValidationError,
    "non-empty modificationRequest",
  );
});

Deno.test("validateModifyRecipeParams: empty modificationRequest throws", () => {
  assertThrows(
    () => validateModifyRecipeParams({ modificationRequest: "" }),
    ToolValidationError,
    "non-empty modificationRequest",
  );
});

Deno.test("validateModifyRecipeParams: whitespace-only throws", () => {
  assertThrows(
    () => validateModifyRecipeParams({ modificationRequest: "   " }),
    ToolValidationError,
    "non-empty modificationRequest",
  );
});

Deno.test("validateModifyRecipeParams: truncates to 2000 chars", () => {
  const longRequest = "a".repeat(3000);
  const result = validateModifyRecipeParams({
    modificationRequest: longRequest,
  });
  assertEquals(result.modificationRequest.length, 2000);
});

Deno.test("validateModifyRecipeParams: accepts JSON string input", () => {
  const result = validateModifyRecipeParams(
    JSON.stringify({ modificationRequest: "remove nuts" }),
  );
  assertEquals(result.modificationRequest, "remove nuts");
});

Deno.test("validateModifyRecipeParams: rejects non-object", () => {
  assertThrows(
    () => validateModifyRecipeParams("not json object"),
    ToolValidationError,
  );
});

// ============================================================
// getModificationSystemPrompt
// ============================================================

Deno.test("getModificationSystemPrompt: EN includes modification rules", () => {
  const prompt = getModificationSystemPrompt(createUserContext());

  assertStringIncludes(prompt, "MODIFICATION MODE");
  assertStringIncludes(prompt, "NOT creating one from scratch");
  assertStringIncludes(prompt, "scaling portions");
});

Deno.test("getModificationSystemPrompt: ES includes base recipe prompt", () => {
  const prompt = getModificationSystemPrompt(
    createUserContext({ language: "es" }),
  );

  assertStringIncludes(prompt, "Mexican Spanish");
  assertStringIncludes(prompt, "MODIFICATION MODE");
});

Deno.test("getModificationSystemPrompt: includes Thermomix section for Thermomix user", () => {
  const prompt = getModificationSystemPrompt(
    createUserContext({ kitchenEquipment: ["Thermomix"] }),
  );

  assertStringIncludes(prompt, "THERMOMIX USAGE");
  assertStringIncludes(prompt, "MODIFICATION MODE");
});

Deno.test("getModificationSystemPrompt: no Thermomix section without Thermomix", () => {
  const prompt = getModificationSystemPrompt(
    createUserContext({ kitchenEquipment: [] }),
  );

  assertEquals(prompt.includes("THERMOMIX USAGE"), false);
  assertStringIncludes(prompt, "MODIFICATION MODE");
});

// ============================================================
// buildModificationPrompt
// ============================================================

Deno.test("buildModificationPrompt: includes recipe JSON", () => {
  const recipe = createMinimalRecipe();
  const params = { modificationRequest: "make it for 6" };
  const prompt = buildModificationPrompt(recipe, params, createUserContext());

  assertStringIncludes(prompt, "ORIGINAL RECIPE:");
  assertStringIncludes(prompt, '"suggestedName": "Chicken Pasta"');
  assertStringIncludes(prompt, "Chicken Pasta");
});

Deno.test("buildModificationPrompt: includes modification text", () => {
  const recipe = createMinimalRecipe();
  const params = { modificationRequest: "without the garlic" };
  const prompt = buildModificationPrompt(recipe, params, createUserContext());

  assertStringIncludes(prompt, "MODIFICATION REQUEST:");
  assertStringIncludes(prompt, "without the garlic");
});

Deno.test("buildModificationPrompt: includes dislikes", () => {
  const recipe = createMinimalRecipe();
  const params = { modificationRequest: "make it spicier" };
  const userContext = createUserContext({
    ingredientDislikes: ["onion", "celery"],
  });
  const prompt = buildModificationPrompt(recipe, params, userContext);

  assertStringIncludes(prompt, "MUST AVOID");
  assertStringIncludes(prompt, "onion, celery");
});

Deno.test("buildModificationPrompt: includes diet types", () => {
  const recipe = createMinimalRecipe();
  const params = { modificationRequest: "more protein" };
  const userContext = createUserContext({
    dietTypes: ["keto"],
  });
  const prompt = buildModificationPrompt(recipe, params, userContext);

  assertStringIncludes(prompt, "User follows: keto");
});

Deno.test("buildModificationPrompt: skips none/other diet types", () => {
  const recipe = createMinimalRecipe();
  const params = { modificationRequest: "more protein" };
  const userContext = createUserContext({
    dietTypes: ["none", "other"],
  });
  const prompt = buildModificationPrompt(recipe, params, userContext);

  assertEquals(prompt.includes("User follows:"), false);
});
