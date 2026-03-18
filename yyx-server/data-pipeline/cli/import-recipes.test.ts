import { assertEquals } from 'std/assert/mod.ts';
import { hasRecipeContent, buildRecipeSteps } from '../lib/import-helpers.ts';
import type { ParsedRecipeData } from '../lib/recipe-parser.ts';

// ─── hasRecipeContent ────────────────────────────────────

Deno.test('hasRecipeContent returns true when ingredients section has items', () => {
  const content = `# Recipe Name

### Ingredientes

- 200 g harina
- 100 ml leche

### Procedimiento
`;
  assertEquals(hasRecipeContent(content), true);
});

Deno.test('hasRecipeContent returns false for empty ingredients section', () => {
  const content = `# Recipe Name

### Ingredientes

-

### Procedimiento
`;
  assertEquals(hasRecipeContent(content), false);
});

Deno.test('hasRecipeContent returns false when no Ingredientes section', () => {
  const content = `# Recipe Name

Some text here.
`;
  assertEquals(hasRecipeContent(content), false);
});

Deno.test('hasRecipeContent returns false for stub with only dashes', () => {
  const content = `# Recipe Name

### Ingredientes

-
-

### Procedimiento

1.
`;
  assertEquals(hasRecipeContent(content), false);
});

Deno.test('hasRecipeContent returns true even with blank lines before ingredients', () => {
  const content = `# Recipe Name

### Ingredientes


- 250 g de aceite de oliva

### Procedimiento
`;
  assertEquals(hasRecipeContent(content), true);
});

// ─── buildRecipeSteps ────────────────────────────────────

function makeStep(overrides: Partial<ParsedRecipeData['steps'][number]>): ParsedRecipeData['steps'][number] {
  return {
    order: 1,
    instructionEn: 'Do something',
    instructionEs: 'Hacer algo',
    thermomixTime: null,
    thermomixTemperature: null,
    thermomixTemperatureUnit: null,
    thermomixSpeed: null,
    thermomixIsBladeReversed: null,
    ingredients: [],
    tipEn: '',
    tipEs: '',
    recipeSectionEn: 'Main',
    recipeSectionEs: 'Principal',
    ...overrides,
  };
}

function makeParsed(steps: ParsedRecipeData['steps']): ParsedRecipeData {
  return {
    nameEn: 'Test',
    nameEs: 'Prueba',
    totalTime: 10,
    prepTime: 5,
    difficulty: 'easy',
    portions: 4,
    tipsAndTricksEn: '',
    tipsAndTricksEs: '',
    kitchenTools: [],
    ingredients: [],
    steps,
    tags: [],
  };
}

Deno.test('buildRecipeSteps re-numbers steps sequentially', () => {
  // Simulate multi-section recipe: meatballs (1,2,3) + sauce (1,2,3,4)
  const parsed = makeParsed([
    makeStep({ order: 1, instructionEn: 'Meatball step 1' }),
    makeStep({ order: 2, instructionEn: 'Meatball step 2' }),
    makeStep({ order: 3, instructionEn: 'Meatball step 3' }),
    makeStep({ order: 1, instructionEn: 'Sauce step 1' }),
    makeStep({ order: 2, instructionEn: 'Sauce step 2' }),
    makeStep({ order: 3, instructionEn: 'Sauce step 3' }),
    makeStep({ order: 4, instructionEn: 'Sauce step 4' }),
  ]);

  const result = buildRecipeSteps('recipe-1', parsed);

  assertEquals(result.length, 7);
  // All orders should be sequential 1-7, not duplicated
  assertEquals(result.map((s) => s.order), [1, 2, 3, 4, 5, 6, 7]);
  assertEquals(result[0].instruction_en, 'Meatball step 1');
  assertEquals(result[3].instruction_en, 'Sauce step 1');
});

Deno.test('buildRecipeSteps extracts single speed', () => {
  const parsed = makeParsed([
    makeStep({
      thermomixTime: 600,
      thermomixTemperature: 90,
      thermomixTemperatureUnit: 'C',
      thermomixSpeed: { type: 'single', value: 'spoon', start: null, end: null },
      thermomixIsBladeReversed: true,
    }),
  ]);

  const result = buildRecipeSteps('recipe-1', parsed);
  assertEquals(result[0].thermomix_speed, 'spoon');
  assertEquals(result[0].thermomix_speed_start, null);
  assertEquals(result[0].thermomix_speed_end, null);
  assertEquals(result[0].thermomix_time, 600);
  assertEquals(result[0].thermomix_temperature, 90);
  assertEquals(result[0].thermomix_is_blade_reversed, true);
});

Deno.test('buildRecipeSteps extracts speed range', () => {
  const parsed = makeParsed([
    makeStep({
      thermomixSpeed: { type: 'range', value: null, start: 4, end: 8 },
    }),
  ]);

  const result = buildRecipeSteps('recipe-1', parsed);
  assertEquals(result[0].thermomix_speed, null);
  assertEquals(result[0].thermomix_speed_start, 4);
  assertEquals(result[0].thermomix_speed_end, 8);
});

Deno.test('buildRecipeSteps defaults section names', () => {
  const parsed = makeParsed([
    makeStep({ recipeSectionEn: '', recipeSectionEs: '' }),
  ]);

  const result = buildRecipeSteps('recipe-1', parsed);
  assertEquals(result[0].recipe_section_en, 'Main');
  assertEquals(result[0].recipe_section_es, 'Principal');
});

Deno.test('buildRecipeSteps returns empty array for no steps', () => {
  const parsed = makeParsed([]);
  const result = buildRecipeSteps('recipe-1', parsed);
  assertEquals(result.length, 0);
});

Deno.test('buildRecipeSteps clamps fractional thermomixTime to rounded integer', () => {
  const parsed = makeParsed([
    makeStep({ thermomixTime: 59.7 }),
  ]);

  const result = buildRecipeSteps('recipe-1', parsed);
  assertEquals(result[0].thermomix_time, 60);
});

Deno.test('buildRecipeSteps clamps sub-1 thermomixTime to minimum of 1', () => {
  const parsed = makeParsed([
    makeStep({ thermomixTime: 0.3 }),
  ]);

  const result = buildRecipeSteps('recipe-1', parsed);
  assertEquals(result[0].thermomix_time, 1);
});

Deno.test('buildRecipeSteps sets thermomix_time to null when not provided', () => {
  const parsed = makeParsed([
    makeStep({ thermomixTime: null }),
  ]);

  const result = buildRecipeSteps('recipe-1', parsed);
  assertEquals(result[0].thermomix_time, null);
});

Deno.test('buildRecipeSteps sets all speed fields to null when no speed', () => {
  const parsed = makeParsed([
    makeStep({ thermomixSpeed: null }),
  ]);

  const result = buildRecipeSteps('recipe-1', parsed);
  assertEquals(result[0].thermomix_speed, null);
  assertEquals(result[0].thermomix_speed_start, null);
  assertEquals(result[0].thermomix_speed_end, null);
});

Deno.test('buildRecipeSteps maps tip fields', () => {
  const parsed = makeParsed([
    makeStep({ tipEn: 'Stir gently', tipEs: 'Revolver suavemente' }),
  ]);

  const result = buildRecipeSteps('recipe-1', parsed);
  assertEquals(result[0].tip_en, 'Stir gently');
  assertEquals(result[0].tip_es, 'Revolver suavemente');
});

Deno.test('buildRecipeSteps sets recipe_id on all steps', () => {
  const parsed = makeParsed([
    makeStep({ order: 1 }),
    makeStep({ order: 2 }),
  ]);

  const result = buildRecipeSteps('my-recipe-id', parsed);
  assertEquals(result.every((s) => s.recipe_id === 'my-recipe-id'), true);
});
