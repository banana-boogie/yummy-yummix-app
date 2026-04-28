import { assert, assertEquals, assertThrows } from 'std/assert/mod.ts';
import {
  parseRecipeMetadataYaml,
  RecipeMetadataValidationError,
} from './recipe-metadata-schema.ts';

const fixturePath = new URL(
  '../data/recipe-metadata/mongolian-beef.yaml',
  import.meta.url,
).pathname;

function loadFixture(): string {
  return Deno.readTextFileSync(fixturePath);
}

Deno.test('parses the canonical Mongolian Beef fixture', () => {
  const { data, warnings } = parseRecipeMetadataYaml(loadFixture());
  assertEquals(warnings.length, 0);
  assertEquals(data.recipe_match.name_en, 'Mongolian Beef');
  assertEquals(data.planner?.role, 'main');
  assertEquals(data.planner?.cooking_level, 'intermediate');
  assertEquals(data.tags?.cuisine, ['chinese', 'asian']);
  assertEquals(data.kitchen_tools?.set.length, 2);
  assertEquals(data.pairings?.set[0].role, 'side');
  assertEquals(data.step_overrides?.[0].thermomix_temperature_unit, 'C');
});

Deno.test('rejects an unknown cooking_level and points at the YAML line', () => {
  const yaml = `recipe_match:
  id: '11111111-1111-1111-1111-111111111111'
  name_en: 'X'
  expected_recipe_updated_at: '2026-04-24T14:02:17.000Z'
review:
  reviewed_by_label: 'claude'
  reviewed_at: '2026-04-24T14:05:00.000Z'
planner:
  cooking_level: hard
`;
  const err = assertThrows(
    () => parseRecipeMetadataYaml(yaml),
    RecipeMetadataValidationError,
  );
  const issue = err.issues.find((i) => i.path === 'planner.cooking_level');
  assert(issue, 'expected an issue at planner.cooking_level');
  assertEquals(issue.line, 9);
});

Deno.test('rejects a non-uuid recipe_match.id with line info', () => {
  const yaml = `recipe_match:
  id: 'not-a-uuid'
  name_en: 'X'
  expected_recipe_updated_at: '2026-04-24T14:02:17.000Z'
review:
  reviewed_by_label: 'claude'
  reviewed_at: '2026-04-24T14:05:00.000Z'
`;
  const err = assertThrows(
    () => parseRecipeMetadataYaml(yaml),
    RecipeMetadataValidationError,
  );
  const issue = err.issues.find((i) => i.path === 'recipe_match.id');
  assert(issue, 'expected an issue at recipe_match.id');
  assertEquals(issue.line, 2);
});

Deno.test('rejects an ingredient match missing both id and slug+order', () => {
  const yaml = `recipe_match:
  id: '11111111-1111-1111-1111-111111111111'
  name_en: 'X'
  expected_recipe_updated_at: '2026-04-24T14:02:17.000Z'
review:
  reviewed_by_label: 'claude'
  reviewed_at: '2026-04-24T14:05:00.000Z'
ingredient_updates:
  - match:
      ingredient_slug: 'garlic'
    quantity: 3
`;
  const err = assertThrows(
    () => parseRecipeMetadataYaml(yaml),
    RecipeMetadataValidationError,
  );
  const issue = err.issues.find((i) => i.path.startsWith('ingredient_updates.0.match'));
  assert(issue, 'expected a match issue');
});

Deno.test('rejects mutually exclusive thermomix_speed and thermomix_speed_range', () => {
  const yaml = `recipe_match:
  id: '11111111-1111-1111-1111-111111111111'
  name_en: 'X'
  expected_recipe_updated_at: '2026-04-24T14:02:17.000Z'
review:
  reviewed_by_label: 'claude'
  reviewed_at: '2026-04-24T14:05:00.000Z'
step_overrides:
  - match: { order: 6 }
    thermomix_speed: 2
    thermomix_speed_range:
      start: 4
      end: 6
`;
  const err = assertThrows(
    () => parseRecipeMetadataYaml(yaml),
    RecipeMetadataValidationError,
  );
  const issue = err.issues.find((i) => i.path === 'step_overrides.0');
  assert(issue, 'expected mutually-exclusive issue at step_overrides.0');
});

Deno.test('rejects a malformed YAML document with parse error line info', () => {
  const yaml = `recipe_match:
  id: '11111111-1111-1111-1111-111111111111'
  name_en: 'X
  expected_recipe_updated_at: '2026-04-24T14:02:17.000Z'
`;
  const err = assertThrows(
    () => parseRecipeMetadataYaml(yaml),
    RecipeMetadataValidationError,
  );
  assert(err.issues[0].message.startsWith('YAML parse error'));
  assert(err.issues[0].line !== undefined);
});

Deno.test('rejects a missing required top-level section', () => {
  const yaml = `recipe_match:
  id: '11111111-1111-1111-1111-111111111111'
  name_en: 'X'
  expected_recipe_updated_at: '2026-04-24T14:02:17.000Z'
`;
  const err = assertThrows(
    () => parseRecipeMetadataYaml(yaml),
    RecipeMetadataValidationError,
  );
  const issue = err.issues.find((i) => i.path === 'review');
  assert(issue, 'expected missing review issue');
});

Deno.test('rejects unknown top-level keys (strict schema)', () => {
  const yaml = `recipe_match:
  id: '11111111-1111-1111-1111-111111111111'
  name_en: 'X'
  expected_recipe_updated_at: '2026-04-24T14:02:17.000Z'
review:
  reviewed_by_label: 'claude'
  reviewed_at: '2026-04-24T14:05:00.000Z'
mystery_section: {}
`;
  const err = assertThrows(
    () => parseRecipeMetadataYaml(yaml),
    RecipeMetadataValidationError,
  );
  assert(
    err.issues.some((i) => i.message.toLowerCase().includes('unrecognized')),
    'expected unrecognized-key issue',
  );
});

Deno.test('rejects an out-of-range thermomix_speed value', () => {
  const yaml = `recipe_match:
  id: '11111111-1111-1111-1111-111111111111'
  name_en: 'X'
  expected_recipe_updated_at: '2026-04-24T14:02:17.000Z'
review:
  reviewed_by_label: 'claude'
  reviewed_at: '2026-04-24T14:05:00.000Z'
step_overrides:
  - match: { order: 1 }
    thermomix_speed: 11
`;
  const err = assertThrows(
    () => parseRecipeMetadataYaml(yaml),
    RecipeMetadataValidationError,
  );
  assert(
    err.issues.some((i) =>
      i.path.includes('step_overrides.0.thermomix_speed') &&
      i.message.toLowerCase().includes('invalid thermomix_speed')
    ),
    'expected schema rejection for thermomix_speed: 11',
  );
});

Deno.test('rejects a non-half-step thermomix_speed (e.g. 2.25)', () => {
  const yaml = `recipe_match:
  id: '11111111-1111-1111-1111-111111111111'
  name_en: 'X'
  expected_recipe_updated_at: '2026-04-24T14:02:17.000Z'
review:
  reviewed_by_label: 'claude'
  reviewed_at: '2026-04-24T14:05:00.000Z'
step_overrides:
  - match: { order: 1 }
    thermomix_speed: 2.25
`;
  assertThrows(
    () => parseRecipeMetadataYaml(yaml),
    RecipeMetadataValidationError,
  );
});

Deno.test('rejects an out-of-range thermomix_temperature value', () => {
  const yaml = `recipe_match:
  id: '11111111-1111-1111-1111-111111111111'
  name_en: 'X'
  expected_recipe_updated_at: '2026-04-24T14:02:17.000Z'
review:
  reviewed_by_label: 'claude'
  reviewed_at: '2026-04-24T14:05:00.000Z'
step_overrides:
  - match: { order: 1 }
    thermomix_temperature: 99
`;
  const err = assertThrows(
    () => parseRecipeMetadataYaml(yaml),
    RecipeMetadataValidationError,
  );
  assert(
    err.issues.some((i) =>
      i.path.includes('thermomix_temperature') &&
      i.message.toLowerCase().includes('invalid thermomix_temperature')
    ),
    'expected schema rejection for thermomix_temperature: 99',
  );
});

Deno.test('accepts TM7-extended thermomix_temperature values (125 °C, 257 °F)', () => {
  // Regression coverage for the TM7 extended enum values added in migration
  // 20260428181507. Picks one Celsius and one Fahrenheit value to keep the
  // schema and DB enum in lockstep on parse.
  const yaml = `recipe_match:
  id: '11111111-1111-1111-1111-111111111111'
  name_en: 'X'
  expected_recipe_updated_at: '2026-04-24T14:02:17.000Z'
review:
  reviewed_by_label: 'claude'
  reviewed_at: '2026-04-24T14:05:00.000Z'
step_overrides:
  - match: { order: 1 }
    thermomix_temperature: 125
    thermomix_temperature_unit: 'C'
  - match: { order: 2 }
    thermomix_temperature: 257
    thermomix_temperature_unit: 'F'
`;
  const parsed = parseRecipeMetadataYaml(yaml);
  assertEquals(parsed.data.step_overrides?.[0].thermomix_temperature, 125);
  assertEquals(parsed.data.step_overrides?.[1].thermomix_temperature, 257);
});

Deno.test('accepts thermomix_speed: spoon and thermomix_temperature: Varoma', () => {
  const yaml = `recipe_match:
  id: '11111111-1111-1111-1111-111111111111'
  name_en: 'X'
  expected_recipe_updated_at: '2026-04-24T14:02:17.000Z'
review:
  reviewed_by_label: 'claude'
  reviewed_at: '2026-04-24T14:05:00.000Z'
step_overrides:
  - match: { order: 1 }
    thermomix_speed: spoon
    thermomix_temperature: Varoma
`;
  const { data } = parseRecipeMetadataYaml(yaml);
  assertEquals(data.step_overrides?.[0].thermomix_speed, 'spoon');
  assertEquals(data.step_overrides?.[0].thermomix_temperature, 'Varoma');
});

Deno.test('accepts dish_type and primary_ingredient tag categories', () => {
  const yaml = `recipe_match:
  id: '11111111-1111-1111-1111-111111111111'
  name_en: 'X'
  expected_recipe_updated_at: '2026-04-24T14:02:17.000Z'
review:
  reviewed_by_label: 'claude'
  reviewed_at: '2026-04-24T14:05:00.000Z'
tags:
  dish_type: [stew, taco]
  primary_ingredient: [beef]
`;
  const { data } = parseRecipeMetadataYaml(yaml);
  assertEquals(data.tags?.dish_type, ['stew', 'taco']);
  assertEquals(data.tags?.primary_ingredient, ['beef']);
});
