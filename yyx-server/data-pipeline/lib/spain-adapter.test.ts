import { assertEquals, assertThrows } from 'std/assert/mod.ts';

// Import the module to access validateSpainAdaptOutput via the exported adaptToSpainSpanish
// Since validateSpainAdaptOutput is not exported, we test it indirectly through a re-export
// or we can test the validation behavior through the public API.
// For unit testing the validator directly, let's import and test it.

// We need to make validateSpainAdaptOutput accessible for testing.
// Since it's not exported, we'll test the validation logic by checking that
// adaptToSpainSpanish would reject bad data. But that requires mocking fetch.
// Instead, let's test the validation rules directly by importing the module
// and calling the function. We'll need to export it first — or test through
// the parseJsonFromLLM + validate path.

// Actually, the cleanest approach: export validateSpainAdaptOutput for testing.
// But since we can't modify the source in this test file, let's test through
// a dynamic import trick or just test the shapes that the schema enforces.

// For a practical approach, let's test the validation by importing the function.
// First check if it's exported...

// The function is not exported, so we'll create focused tests using a local copy
// of the validation logic, which verifies the same constraints.

// Better approach: Let's just export it and import here.

// NOTE: This test file assumes validateSpainAdaptOutput is exported from spain-adapter.ts.
// We'll add the export.

import { validateSpainAdaptOutput } from './spain-adapter.ts';

Deno.test('validateSpainAdaptOutput - valid full output passes', () => {
  const valid = {
    recipeName: 'Tortilla española',
    tipsAndTricks: 'Usar patatas de calidad',
    steps: [
      { order: 1, instruction: 'Pelar las patatas', section: 'Preparación', tip: 'Cortar fino' },
    ],
    ingredientNotes: [
      { displayOrder: 1, notes: 'Frescos', tip: 'De temporada', section: 'Base' },
    ],
    newIngredients: [
      { name: 'Patata', pluralName: 'Patatas' },
    ],
    newKitchenTools: [
      { name: 'Sartén' },
    ],
  };

  // Should not throw
  validateSpainAdaptOutput(valid);
});

Deno.test('validateSpainAdaptOutput - minimal valid output (all optional fields undefined)', () => {
  const minimal = {};
  // All fields are optional per the interface, should not throw
  validateSpainAdaptOutput(minimal);
});

Deno.test('validateSpainAdaptOutput - non-object input throws', () => {
  assertThrows(
    () => validateSpainAdaptOutput('not an object'),
    Error,
    'expected a JSON object',
  );
  assertThrows(
    () => validateSpainAdaptOutput(null),
    Error,
    'expected a JSON object',
  );
  assertThrows(
    () => validateSpainAdaptOutput([]),
    Error,
    'expected a JSON object',
  );
});

Deno.test('validateSpainAdaptOutput - recipeName as number throws', () => {
  assertThrows(
    () => validateSpainAdaptOutput({ recipeName: 42 }),
    Error,
    '"recipeName" must be a string',
  );
});

Deno.test('validateSpainAdaptOutput - tipsAndTricks as number throws', () => {
  assertThrows(
    () => validateSpainAdaptOutput({ tipsAndTricks: true }),
    Error,
    '"tipsAndTricks" must be a string',
  );
});

Deno.test('validateSpainAdaptOutput - steps as non-array throws', () => {
  assertThrows(
    () => validateSpainAdaptOutput({ steps: 'not array' }),
    Error,
    '"steps" must be an array',
  );
});

Deno.test('validateSpainAdaptOutput - step with non-number order throws', () => {
  assertThrows(
    () => validateSpainAdaptOutput({ steps: [{ order: 'one', instruction: 'x' }] }),
    Error,
    'step "order" must be a number',
  );
});

Deno.test('validateSpainAdaptOutput - step with non-string instruction throws', () => {
  assertThrows(
    () => validateSpainAdaptOutput({ steps: [{ order: 1, instruction: 42 }] }),
    Error,
    'step "instruction" must be a string',
  );
});

Deno.test('validateSpainAdaptOutput - ingredientNotes as non-array throws', () => {
  assertThrows(
    () => validateSpainAdaptOutput({ ingredientNotes: {} }),
    Error,
    '"ingredientNotes" must be an array',
  );
});

Deno.test('validateSpainAdaptOutput - ingredientNote with non-number displayOrder throws', () => {
  assertThrows(
    () => validateSpainAdaptOutput({ ingredientNotes: [{ displayOrder: 'x' }] }),
    Error,
    '"displayOrder" must be a number',
  );
});

Deno.test('validateSpainAdaptOutput - newIngredient missing pluralName throws', () => {
  assertThrows(
    () => validateSpainAdaptOutput({ newIngredients: [{ name: 'Patata' }] }),
    Error,
    'must have "name" and "pluralName" strings',
  );
});

Deno.test('validateSpainAdaptOutput - newKitchenTool missing name throws', () => {
  assertThrows(
    () => validateSpainAdaptOutput({ newKitchenTools: [{}] }),
    Error,
    'must have a "name" string',
  );
});

Deno.test('validateSpainAdaptOutput - empty arrays pass', () => {
  const empty = {
    steps: [],
    ingredientNotes: [],
    newIngredients: [],
    newKitchenTools: [],
  };
  // Should not throw
  validateSpainAdaptOutput(empty);
});
