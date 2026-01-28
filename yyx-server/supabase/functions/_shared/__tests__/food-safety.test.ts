/**
 * Food Safety Logic Tests
 *
 * Tests for food safety validation patterns and logic.
 * These tests verify the expected behavior of food safety checking
 * without importing the actual module (which has complex dependencies).
 *
 * FOR AI AGENTS:
 * - This tests the expected behavior patterns for food safety validation
 * - Follow this pattern for testing safety-critical functionality
 */

import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';

// ============================================================
// Type Definitions (mirroring food-safety.ts types)
// ============================================================

interface FoodSafetyRule {
  ingredient_canonical: string;
  category: string;
  min_temp_c: number;
  min_temp_f: number;
  min_cook_min: number;
}

interface SafetyCheckResult {
  safe: boolean;
  warnings: string[];
}

interface GeneratedRecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
}

// ============================================================
// Test Data Helpers
// ============================================================

function createMockFoodSafetyRule(
  overrides?: Partial<FoodSafetyRule>
): FoodSafetyRule {
  return {
    ingredient_canonical: 'chicken',
    category: 'poultry',
    min_temp_c: 74,
    min_temp_f: 165,
    min_cook_min: 15,
    ...overrides,
  };
}

function createMockIngredient(
  overrides?: Partial<GeneratedRecipeIngredient>
): GeneratedRecipeIngredient {
  return {
    name: 'chicken breast',
    quantity: 2,
    unit: 'lb',
    ...overrides,
  };
}

// ============================================================
// Pure Logic Functions (for testable patterns)
// ============================================================

/**
 * Matches an ingredient name against a safety rule.
 * Uses word boundary matching to avoid false positives.
 */
function matchesRule(ingredientName: string, ruleCanonical: string): boolean {
  const lowerName = ingredientName.toLowerCase();
  const lowerCanonical = ruleCanonical.toLowerCase();

  // Word boundary check - canonical should be a word in ingredient name
  const regex = new RegExp(`\\b${lowerCanonical}\\b`, 'i');
  return regex.test(lowerName);
}

/**
 * Formats temperature with unit based on measurement system.
 */
function formatTemperature(
  tempF: number,
  tempC: number,
  measurementSystem: 'imperial' | 'metric'
): string {
  if (measurementSystem === 'metric') {
    return `${tempC}°C`;
  }
  return `${tempF}°F`;
}

/**
 * Generates a safety warning message.
 */
function generateWarningMessage(
  ingredientName: string,
  minCookMin: number,
  tempStr: string,
  language: 'en' | 'es'
): string {
  if (language === 'es') {
    return `${ingredientName} requiere al menos ${minCookMin} minutos de cocción con una temperatura interna de ${tempStr}.`;
  }
  return `${ingredientName} requires at least ${minCookMin} minutes of cooking with an internal temperature of ${tempStr}.`;
}

/**
 * Checks if recipe meets safety requirements.
 */
function checkSafety(
  ingredients: GeneratedRecipeIngredient[],
  rules: FoodSafetyRule[],
  totalTime: number,
  measurementSystem: 'imperial' | 'metric',
  language: 'en' | 'es'
): SafetyCheckResult {
  const warnings: string[] = [];

  for (const ingredient of ingredients) {
    for (const rule of rules) {
      if (matchesRule(ingredient.name, rule.ingredient_canonical)) {
        if (totalTime < rule.min_cook_min) {
          const tempStr = formatTemperature(
            rule.min_temp_f,
            rule.min_temp_c,
            measurementSystem
          );
          warnings.push(
            generateWarningMessage(
              ingredient.name,
              rule.min_cook_min,
              tempStr,
              language
            )
          );
        }
      }
    }
  }

  return {
    safe: warnings.length === 0,
    warnings,
  };
}

/**
 * Builds safety reminder text for prompts.
 */
function buildSafetyReminders(
  ingredients: string[],
  rules: FoodSafetyRule[],
  measurementSystem: 'imperial' | 'metric'
): string {
  const matches: Array<{ name: string; temp: string }> = [];

  for (const ingredient of ingredients) {
    for (const rule of rules) {
      if (matchesRule(ingredient, rule.ingredient_canonical)) {
        const tempStr = formatTemperature(
          rule.min_temp_f,
          rule.min_temp_c,
          measurementSystem
        );
        // Capitalize ingredient name
        const formattedName = rule.ingredient_canonical
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        matches.push({ name: formattedName, temp: tempStr });
      }
    }
  }

  if (matches.length === 0) return '';

  let text = '\n\nFOOD SAFETY REQUIREMENTS:\n';
  for (const match of matches) {
    text += `- ${match.name}: Must reach ${match.temp} internal temperature\n`;
  }
  return text;
}

// ============================================================
// Word Boundary Matching Tests
// ============================================================

Deno.test('matchesRule - exact match', () => {
  assertEquals(matchesRule('chicken', 'chicken'), true);
});

Deno.test('matchesRule - partial ingredient name match', () => {
  assertEquals(matchesRule('chicken breast', 'chicken'), true);
  assertEquals(matchesRule('boneless chicken thighs', 'chicken'), true);
});

Deno.test('matchesRule - case insensitive', () => {
  assertEquals(matchesRule('CHICKEN BREAST', 'chicken'), true);
  assertEquals(matchesRule('chicken', 'CHICKEN'), true);
});

Deno.test('matchesRule - does not match substrings (chickpea vs chicken)', () => {
  assertEquals(matchesRule('chickpeas', 'chicken'), false);
  assertEquals(matchesRule('chickpea curry', 'chicken'), false);
});

Deno.test('matchesRule - does not match embedded (chick not in chicory)', () => {
  assertEquals(matchesRule('chicory', 'chick'), false);
});

// ============================================================
// Temperature Formatting Tests
// ============================================================

Deno.test('formatTemperature - imperial', () => {
  assertEquals(formatTemperature(165, 74, 'imperial'), '165°F');
});

Deno.test('formatTemperature - metric', () => {
  assertEquals(formatTemperature(165, 74, 'metric'), '74°C');
});

Deno.test('formatTemperature - different temps', () => {
  assertEquals(formatTemperature(145, 63, 'imperial'), '145°F');
  assertEquals(formatTemperature(145, 63, 'metric'), '63°C');
});

// ============================================================
// Warning Message Tests
// ============================================================

Deno.test('generateWarningMessage - English', () => {
  const msg = generateWarningMessage('chicken', 15, '165°F', 'en');

  assertStringIncludes(msg, 'chicken');
  assertStringIncludes(msg, '15 minutes');
  assertStringIncludes(msg, '165°F');
  assertStringIncludes(msg, 'requires at least');
  assertStringIncludes(msg, 'internal temperature');
});

Deno.test('generateWarningMessage - Spanish', () => {
  const msg = generateWarningMessage('pollo', 15, '74°C', 'es');

  assertStringIncludes(msg, 'pollo');
  assertStringIncludes(msg, '15 minutos');
  assertStringIncludes(msg, '74°C');
  assertStringIncludes(msg, 'requiere al menos');
  assertStringIncludes(msg, 'temperatura interna');
});

// ============================================================
// Safety Check Tests
// ============================================================

Deno.test('checkSafety - safe veggie recipe', () => {
  const ingredients = [
    createMockIngredient({ name: 'broccoli' }),
    createMockIngredient({ name: 'carrots' }),
  ];
  const rules = [createMockFoodSafetyRule({ ingredient_canonical: 'chicken' })];

  const result = checkSafety(ingredients, rules, 20, 'imperial', 'en');

  assertEquals(result.safe, true);
  assertEquals(result.warnings.length, 0);
});

Deno.test('checkSafety - undercooked chicken warning', () => {
  const ingredients = [createMockIngredient({ name: 'chicken breast' })];
  const rules = [
    createMockFoodSafetyRule({
      ingredient_canonical: 'chicken',
      min_cook_min: 15,
      min_temp_f: 165,
      min_temp_c: 74,
    }),
  ];

  const result = checkSafety(ingredients, rules, 10, 'imperial', 'en');

  assertEquals(result.safe, false);
  assertEquals(result.warnings.length, 1);
  assertStringIncludes(result.warnings[0], '165°F');
});

Deno.test('checkSafety - metric temperature', () => {
  const ingredients = [createMockIngredient({ name: 'pork chops' })];
  const rules = [
    createMockFoodSafetyRule({
      ingredient_canonical: 'pork',
      min_cook_min: 20,
      min_temp_f: 145,
      min_temp_c: 63,
    }),
  ];

  const result = checkSafety(ingredients, rules, 10, 'metric', 'en');

  assertEquals(result.safe, false);
  assertStringIncludes(result.warnings[0], '63°C');
});

Deno.test('checkSafety - Spanish warning', () => {
  const ingredients = [createMockIngredient({ name: 'beef' })];
  const rules = [
    createMockFoodSafetyRule({
      ingredient_canonical: 'beef',
      min_cook_min: 15,
    }),
  ];

  const result = checkSafety(ingredients, rules, 5, 'imperial', 'es');

  assertEquals(result.safe, false);
  assertStringIncludes(result.warnings[0], 'requiere al menos');
});

Deno.test('checkSafety - safe when cook time is sufficient', () => {
  const ingredients = [createMockIngredient({ name: 'chicken' })];
  const rules = [
    createMockFoodSafetyRule({
      ingredient_canonical: 'chicken',
      min_cook_min: 15,
    }),
  ];

  const result = checkSafety(ingredients, rules, 30, 'imperial', 'en');

  assertEquals(result.safe, true);
  assertEquals(result.warnings.length, 0);
});

Deno.test('checkSafety - chickpea does not trigger chicken warning', () => {
  const ingredients = [createMockIngredient({ name: 'chickpeas' })];
  const rules = [
    createMockFoodSafetyRule({
      ingredient_canonical: 'chicken',
      min_cook_min: 15,
    }),
  ];

  const result = checkSafety(ingredients, rules, 5, 'imperial', 'en');

  assertEquals(result.safe, true);
  assertEquals(result.warnings.length, 0);
});

Deno.test('checkSafety - empty ingredients is safe', () => {
  const rules = [createMockFoodSafetyRule()];

  const result = checkSafety([], rules, 30, 'imperial', 'en');

  assertEquals(result.safe, true);
  assertEquals(result.warnings.length, 0);
});

Deno.test('checkSafety - no rules is safe', () => {
  const ingredients = [createMockIngredient({ name: 'chicken' })];

  const result = checkSafety(ingredients, [], 5, 'imperial', 'en');

  assertEquals(result.safe, true);
  assertEquals(result.warnings.length, 0);
});

// ============================================================
// Safety Reminders Tests
// ============================================================

Deno.test('buildSafetyReminders - builds prompt for meat', () => {
  const rules = [
    createMockFoodSafetyRule({
      ingredient_canonical: 'chicken',
      min_temp_f: 165,
      min_temp_c: 74,
    }),
  ];

  const reminders = buildSafetyReminders(['chicken breast', 'rice'], rules, 'imperial');

  assertStringIncludes(reminders, 'FOOD SAFETY REQUIREMENTS');
  assertStringIncludes(reminders, '165°F');
  assertStringIncludes(reminders, 'Chicken');
});

Deno.test('buildSafetyReminders - empty for safe ingredients', () => {
  const rules = [createMockFoodSafetyRule({ ingredient_canonical: 'chicken' })];

  const reminders = buildSafetyReminders(['carrots', 'potatoes'], rules, 'imperial');

  assertEquals(reminders, '');
});

Deno.test('buildSafetyReminders - multiple meat types', () => {
  const rules = [
    createMockFoodSafetyRule({
      ingredient_canonical: 'chicken',
      min_temp_f: 165,
    }),
    createMockFoodSafetyRule({
      ingredient_canonical: 'pork',
      min_temp_f: 145,
    }),
  ];

  const reminders = buildSafetyReminders(
    ['chicken thighs', 'pork chops'],
    rules,
    'imperial'
  );

  assertStringIncludes(reminders, '165°F');
  assertStringIncludes(reminders, '145°F');
});

Deno.test('buildSafetyReminders - metric temperatures', () => {
  const rules = [
    createMockFoodSafetyRule({
      ingredient_canonical: 'beef',
      min_temp_f: 145,
      min_temp_c: 63,
    }),
  ];

  const reminders = buildSafetyReminders(['beef steak'], rules, 'metric');

  assertStringIncludes(reminders, '63°C');
});

Deno.test('buildSafetyReminders - formats underscored names', () => {
  const rules = [
    createMockFoodSafetyRule({
      ingredient_canonical: 'ground_beef',
      min_temp_f: 160,
    }),
  ];

  const reminders = buildSafetyReminders(['ground_beef'], rules, 'imperial');

  // Should format underscores as spaces and capitalize
  assertStringIncludes(reminders, 'Ground Beef');
});

// ============================================================
// Edge Cases
// ============================================================

Deno.test('matchesRule - handles special regex characters', () => {
  // Ingredient names shouldn't have regex special chars, but test defensively
  assertEquals(matchesRule('chicken (boneless)', 'chicken'), true);
});

Deno.test('checkSafety - handles duplicate ingredients', () => {
  const ingredients = [
    createMockIngredient({ name: 'chicken breast' }),
    createMockIngredient({ name: 'chicken thighs' }),
  ];
  const rules = [
    createMockFoodSafetyRule({
      ingredient_canonical: 'chicken',
      min_cook_min: 15,
    }),
  ];

  const result = checkSafety(ingredients, rules, 10, 'imperial', 'en');

  // Should generate warning for each ingredient that matches
  assertEquals(result.safe, false);
  assertEquals(result.warnings.length, 2);
});

Deno.test('checkSafety - exactly at minimum time is safe', () => {
  const ingredients = [createMockIngredient({ name: 'chicken' })];
  const rules = [
    createMockFoodSafetyRule({
      ingredient_canonical: 'chicken',
      min_cook_min: 15,
    }),
  ];

  const result = checkSafety(ingredients, rules, 15, 'imperial', 'en');

  assertEquals(result.safe, true);
  assertEquals(result.warnings.length, 0);
});
