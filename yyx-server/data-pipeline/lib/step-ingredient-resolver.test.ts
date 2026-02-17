import { assertEquals } from 'std/assert/mod.ts';
import type { ParsedRecipeData } from './recipe-parser.ts';
import type { DbIngredient, DbMeasurementUnit } from './entity-matcher.ts';
import { resolveStepIngredients } from './step-ingredient-resolver.ts';

function createParsedRecipe(
  steps: ParsedRecipeData['steps'],
): ParsedRecipeData {
  return {
    nameEn: 'Test Recipe',
    nameEs: 'Receta de Prueba',
    totalTime: 30,
    prepTime: 10,
    difficulty: 'easy',
    portions: 2,
    tipsAndTricksEn: '',
    tipsAndTricksEs: '',
    usefulItems: [],
    ingredients: [],
    steps,
    tags: [],
  };
}

function createUnits(): DbMeasurementUnit[] {
  return [{
    id: 'g',
    type: 'weight',
    system: 'metric',
    name_en: 'gram',
    name_es: 'gramo',
    symbol_en: 'g',
    symbol_es: 'g',
  }];
}

function createIngredientRow(
  overrides: Partial<DbIngredient> = {},
): DbIngredient {
  return {
    id: 'ing-1',
    name_en: 'onion',
    name_es: 'cebolla',
    plural_name_en: 'onions',
    plural_name_es: 'cebollas',
    image_url: '',
    nutritional_facts: null,
    ...overrides,
  };
}

function createStepIngredient(
  nameEn: string,
  nameEs: string,
): ParsedRecipeData['steps'][number]['ingredients'][number] {
  return {
    ingredient: {
      nameEn,
      nameEs,
      pluralNameEn: `${nameEn}s`,
      pluralNameEs: `${nameEs}s`,
    },
    quantity: 100,
    measurementUnitID: 'g',
    displayOrder: 1,
  };
}

function createStep(
  order: number,
  ingredients: ParsedRecipeData['steps'][number]['ingredients'],
): ParsedRecipeData['steps'][number] {
  return {
    order,
    instructionEn: 'Add ingredient',
    instructionEs: 'Agrega ingrediente',
    thermomixTime: null,
    thermomixTemperature: null,
    thermomixTemperatureUnit: null,
    thermomixSpeed: null,
    thermomixIsBladeReversed: null,
    ingredients,
    tipEn: '',
    tipEs: '',
    recipeSectionEn: 'Main',
    recipeSectionEs: 'Principal',
  };
}

Deno.test('resolveStepIngredients uses matcher fallback before failing', () => {
  const parsed = createParsedRecipe([
    createStep(1, [createStepIngredient('chopped onion', 'cebolla')]),
  ]);

  const result = resolveStepIngredients(
    'recipe-1',
    parsed,
    [{ id: 'step-1', order: 1 }],
    new Map(),
    [createIngredientRow()],
    createUnits(),
  );

  assertEquals(result.unresolved.length, 0);
  assertEquals(result.items.length, 1);
  assertEquals(result.items[0].ingredient_id, 'ing-1');
});

Deno.test('resolveStepIngredients reports unresolved ingredients', () => {
  const parsed = createParsedRecipe([
    createStep(1, [createStepIngredient('mystery ingredient', 'ingrediente misterio')]),
  ]);

  const result = resolveStepIngredients(
    'recipe-1',
    parsed,
    [{ id: 'step-1', order: 1 }],
    new Map(),
    [],
    createUnits(),
  );

  assertEquals(result.items.length, 0);
  assertEquals(result.unresolved.length, 1);
  assertEquals(result.unresolved[0].reason, 'ingredient_not_found');
});

Deno.test('resolveStepIngredients reports missing step mapping', () => {
  const parsed = createParsedRecipe([
    createStep(99, [createStepIngredient('onion', 'cebolla')]),
  ]);

  const result = resolveStepIngredients(
    'recipe-1',
    parsed,
    [],
    new Map(),
    [createIngredientRow()],
    createUnits(),
  );

  assertEquals(result.items.length, 0);
  assertEquals(result.unresolved.length, 1);
  assertEquals(result.unresolved[0].reason, 'missing_step_mapping');
  assertEquals(result.unresolved[0].stepOrder, 99);
});
