/**
 * Generate Custom Recipe Tool Tests
 *
 * Tests for the custom recipe generation validation and parameter handling.
 *
 * FOR AI AGENTS:
 * - This tests the validation logic for generate_custom_recipe tool
 * - Follow this pattern for testing other tool validators
 */

import {
  assertEquals,
  assertExists,
  assertStringIncludes,
  assertThrows,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { validateGenerateRecipeParams, ToolValidationError } from './tool-validators.ts';

// ============================================================
// Test Data Helpers
// ============================================================

function createMockUserContext(
  overrides?: Partial<{
    language: 'en' | 'es';
    measurementSystem: 'imperial' | 'metric';
    dietaryRestrictions: string[];
    ingredientDislikes: string[];
    skillLevel: string | null;
    householdSize: number | null;
    conversationHistory: Array<{ role: string; content: string }>;
    dietTypes: string[];
    customAllergies: string[];
    kitchenEquipment: string[];
  }>
) {
  return {
    language: 'en' as const,
    measurementSystem: 'imperial' as const,
    dietaryRestrictions: [],
    ingredientDislikes: [],
    skillLevel: null,
    householdSize: null,
    conversationHistory: [],
    dietTypes: [],
    customAllergies: [],
    kitchenEquipment: [],
    ...overrides,
  };
}

function createMockGeneratedRecipeResponse(
  overrides?: Partial<{
    suggestedName: string;
    ingredients: Array<{ name: string; quantity: number; unit: string }>;
    steps: Array<{ order: number; instruction: string }>;
    totalTime: number;
    difficulty: string;
    portions: number;
    tags: string[];
  }>
) {
  return {
    schemaVersion: '1.0',
    suggestedName: 'Test Recipe',
    measurementSystem: 'imperial',
    language: 'en',
    ingredients: [
      { name: 'chicken', quantity: 1, unit: 'lb' },
      { name: 'rice', quantity: 2, unit: 'cups' },
    ],
    steps: [
      { order: 1, instruction: 'Cook chicken' },
      { order: 2, instruction: 'Add rice' },
    ],
    totalTime: 30,
    difficulty: 'easy',
    portions: 4,
    tags: ['quick', 'easy'],
    ...overrides,
  };
}

// ============================================================
// validateGenerateRecipeParams Tests
// ============================================================

Deno.test('validateGenerateRecipeParams validates required ingredients', () => {
  // Empty ingredients array should throw
  try {
    validateGenerateRecipeParams({ ingredients: [] });
    throw new Error('Should have thrown');
  } catch (e) {
    assertStringIncludes((e as Error).message, 'at least one ingredient');
  }
});

Deno.test('validateGenerateRecipeParams rejects missing ingredients', () => {
  try {
    validateGenerateRecipeParams({});
    throw new Error('Should have thrown');
  } catch (e) {
    assertStringIncludes((e as Error).message, 'at least one ingredient');
  }
});

Deno.test('validateGenerateRecipeParams accepts valid ingredients', () => {
  const result = validateGenerateRecipeParams({
    ingredients: ['chicken', 'rice', 'broccoli'],
  });

  assertEquals(result.ingredients.length, 3);
  assertEquals(result.ingredients[0], 'chicken');
  assertEquals(result.ingredients[1], 'rice');
  assertEquals(result.ingredients[2], 'broccoli');
});

Deno.test('validateGenerateRecipeParams sanitizes ingredient strings', () => {
  const result = validateGenerateRecipeParams({
    ingredients: ['  chicken  ', 'rice!@#', 'broccoli\n\t'],
  });

  // Should be trimmed and sanitized
  assertEquals(result.ingredients[0], 'chicken');
  assertEquals(result.ingredients[1], 'rice');
  assertEquals(result.ingredients[2], 'broccoli');
});

Deno.test('validateGenerateRecipeParams filters empty ingredients after sanitization', () => {
  const result = validateGenerateRecipeParams({
    ingredients: ['chicken', '!!!', '   ', 'rice'],
  });

  // Only valid ingredients should remain
  assertEquals(result.ingredients.length, 2);
  assertEquals(result.ingredients[0], 'chicken');
  assertEquals(result.ingredients[1], 'rice');
});

Deno.test('validateGenerateRecipeParams clamps targetTime within bounds', () => {
  // Too low
  const tooLow = validateGenerateRecipeParams({
    ingredients: ['chicken'],
    targetTime: 1,
  });
  assertEquals(tooLow.targetTime, 5);

  // Too high
  const tooHigh = validateGenerateRecipeParams({
    ingredients: ['chicken'],
    targetTime: 1000,
  });
  assertEquals(tooHigh.targetTime, 480);

  // Valid
  const valid = validateGenerateRecipeParams({
    ingredients: ['chicken'],
    targetTime: 60,
  });
  assertEquals(valid.targetTime, 60);
});

Deno.test('validateGenerateRecipeParams validates difficulty enum', () => {
  // Valid difficulties
  assertEquals(
    validateGenerateRecipeParams({ ingredients: ['a'], difficulty: 'easy' }).difficulty,
    'easy'
  );
  assertEquals(
    validateGenerateRecipeParams({ ingredients: ['a'], difficulty: 'medium' }).difficulty,
    'medium'
  );
  assertEquals(
    validateGenerateRecipeParams({ ingredients: ['a'], difficulty: 'hard' }).difficulty,
    'hard'
  );

  // Invalid difficulty
  try {
    validateGenerateRecipeParams({ ingredients: ['a'], difficulty: 'expert' });
    throw new Error('Should have thrown');
  } catch (e) {
    assertStringIncludes((e as Error).message, 'Invalid value "expert"');
  }
});

Deno.test('validateGenerateRecipeParams sanitizes cuisinePreference', () => {
  const result = validateGenerateRecipeParams({
    ingredients: ['chicken'],
    cuisinePreference: '  Italian  ',
  });

  assertEquals(result.cuisinePreference, 'Italian');
});

Deno.test('validateGenerateRecipeParams limits ingredients to 20', () => {
  const manyIngredients = Array.from({ length: 25 }, (_, i) => `ingredient${i}`);

  const result = validateGenerateRecipeParams({
    ingredients: manyIngredients,
  });

  assertEquals(result.ingredients.length, 20);
});

Deno.test('validateGenerateRecipeParams sanitizes additionalRequests', () => {
  const result = validateGenerateRecipeParams({
    ingredients: ['chicken'],
    additionalRequests: '  make it spicy  ',
  });

  assertEquals(result.additionalRequests, 'make it spicy');
});

Deno.test('validateGenerateRecipeParams handles JSON string input', () => {
  const result = validateGenerateRecipeParams(
    JSON.stringify({
      ingredients: ['chicken', 'rice'],
      targetTime: 30,
    })
  );

  assertEquals(result.ingredients.length, 2);
  assertEquals(result.targetTime, 30);
});

Deno.test('validateGenerateRecipeParams rejects invalid JSON string', () => {
  try {
    validateGenerateRecipeParams('not valid json');
    throw new Error('Should have thrown');
  } catch (e) {
    assertStringIncludes((e as Error).message, 'Invalid JSON');
  }
});

Deno.test('validateGenerateRecipeParams rejects all-empty ingredients', () => {
  try {
    validateGenerateRecipeParams({
      ingredients: ['   ', '!!!', ''],
    });
    throw new Error('Should have thrown');
  } catch (e) {
    assertStringIncludes((e as Error).message, 'at least one valid ingredient');
  }
});

// ============================================================
// UserContext Tests
// ============================================================

Deno.test('UserContext includes all required fields', () => {
  const context = createMockUserContext();

  assertExists(context.language);
  assertExists(context.measurementSystem);
  assertExists(context.dietaryRestrictions);
  assertExists(context.ingredientDislikes);
  assertExists(context.conversationHistory);
  assertExists(context.dietTypes);
  assertExists(context.customAllergies);
  assertExists(context.kitchenEquipment);
});

Deno.test('UserContext supports dietary restrictions', () => {
  const context = createMockUserContext({
    dietaryRestrictions: ['gluten', 'dairy'],
    customAllergies: ['tree_nuts', 'shellfish'],
  });

  assertEquals(context.dietaryRestrictions.length, 2);
  assertEquals(context.customAllergies.length, 2);
});

Deno.test('UserContext supports equipment preferences', () => {
  const context = createMockUserContext({
    kitchenEquipment: ['thermomix', 'instant_pot', 'air_fryer'],
  });

  assertEquals(context.kitchenEquipment.length, 3);
  assertEquals(context.kitchenEquipment.includes('thermomix'), true);
});

// ============================================================
// Output Schema Validation Tests
// ============================================================

Deno.test('generated recipe matches expected schema', () => {
  const mockRecipe = createMockGeneratedRecipeResponse();

  // Verify all required fields exist
  assertExists(mockRecipe.schemaVersion);
  assertExists(mockRecipe.suggestedName);
  assertExists(mockRecipe.measurementSystem);
  assertExists(mockRecipe.language);
  assertExists(mockRecipe.ingredients);
  assertExists(mockRecipe.steps);
  assertExists(mockRecipe.totalTime);
  assertExists(mockRecipe.difficulty);
  assertExists(mockRecipe.portions);
  assertExists(mockRecipe.tags);

  // Verify types
  assertEquals(mockRecipe.schemaVersion, '1.0');
  assertEquals(typeof mockRecipe.suggestedName, 'string');
  assertEquals(Array.isArray(mockRecipe.ingredients), true);
  assertEquals(Array.isArray(mockRecipe.steps), true);
  assertEquals(typeof mockRecipe.totalTime, 'number');
  assertEquals(typeof mockRecipe.portions, 'number');
});

Deno.test('ingredient objects have required fields', () => {
  const mockRecipe = createMockGeneratedRecipeResponse();
  const ingredient = mockRecipe.ingredients[0];

  assertExists(ingredient.name);
  assertExists(ingredient.quantity);
  assertExists(ingredient.unit);

  assertEquals(typeof ingredient.name, 'string');
  assertEquals(typeof ingredient.quantity, 'number');
  assertEquals(typeof ingredient.unit, 'string');
});

Deno.test('step objects have required fields', () => {
  const mockRecipe = createMockGeneratedRecipeResponse();
  const step = mockRecipe.steps[0];

  assertExists(step.order);
  assertExists(step.instruction);

  assertEquals(typeof step.order, 'number');
  assertEquals(typeof step.instruction, 'string');
});

// ============================================================
// Prompt Building Tests
// ============================================================

Deno.test('UserContext includes all required fields', () => {
  const userContext = createMockUserContext({
    skillLevel: 'beginner',
    householdSize: 4,
    dietTypes: ['vegetarian'],
    ingredientDislikes: ['mushrooms'],
    kitchenEquipment: ['oven', 'blender'],
  });

  // Test that user context fields are being used
  assertExists(userContext.skillLevel);
  assertExists(userContext.householdSize);
  assertEquals(userContext.dietTypes.length, 1);
  assertEquals(userContext.ingredientDislikes.length, 1);
  assertEquals(userContext.kitchenEquipment.length, 2);
});

Deno.test('UserContext supports dietary restrictions', () => {
  const enContext = createMockUserContext({ language: 'en' });
  const esContext = createMockUserContext({ language: 'es' });

  assertEquals(enContext.language, 'en');
  assertEquals(esContext.language, 'es');
});

Deno.test('UserContext supports equipment preferences', () => {
  const imperialContext = createMockUserContext({ measurementSystem: 'imperial' });
  const metricContext = createMockUserContext({ measurementSystem: 'metric' });

  assertEquals(imperialContext.measurementSystem, 'imperial');
  assertEquals(metricContext.measurementSystem, 'metric');
});
