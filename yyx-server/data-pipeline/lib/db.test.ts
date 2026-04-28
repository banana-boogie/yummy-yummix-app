import { assertEquals, assertRejects } from 'std/assert/mod.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createRecipe,
  escapeIlike,
  findRecipeByName,
  insertRecipeSteps,
  upsertIngredientNutrition,
} from './db.ts';

type MaybeSingleResult = {
  data?: { recipe_id: string } | null;
  error?: { message: string } | null;
};

function createMockSupabase(results: MaybeSingleResult[]): {
  client: SupabaseClient;
  patterns: string[];
} {
  const patterns: string[] = [];
  let maybeSingleCallCount = 0;

  const chain = {
    select: () => chain,
    eq: () => chain,
    ilike: (_column: string, value: string) => {
      patterns.push(value);
      return chain;
    },
    limit: () => chain,
    maybeSingle: async () => {
      const result = results[maybeSingleCallCount++] || {};
      return {
        data: result.data ?? null,
        error: result.error ?? null,
      };
    },
  };

  return {
    client: {
      from: () => chain,
    } as unknown as SupabaseClient,
    patterns,
  };
}

Deno.test('escapeIlike escapes wildcard characters', () => {
  assertEquals(escapeIlike('50%_off'), '50\\%\\_off');
});

Deno.test('findRecipeByName escapes and finds English match first', async () => {
  const { client, patterns } = createMockSupabase([
    { data: { recipe_id: 'recipe-en' }, error: null },
  ]);

  const id = await findRecipeByName(client, 'Best 50%_Soup', 'Sopa');
  assertEquals(id, 'recipe-en');
  assertEquals(patterns, ['Best 50\\%\\_Soup']);
});

Deno.test('findRecipeByName falls back to Spanish search', async () => {
  const { client, patterns } = createMockSupabase([
    { data: null, error: null },
    { data: { recipe_id: 'recipe-es' }, error: null },
  ]);

  const id = await findRecipeByName(client, 'Soup', 'Sopa_100%');
  assertEquals(id, 'recipe-es');
  assertEquals(patterns, ['Soup', 'Sopa\\_100\\%']);
});

Deno.test('findRecipeByName throws on query error', async () => {
  const { client } = createMockSupabase([
    { data: null, error: { message: 'db broke' } },
  ]);

  await assertRejects(
    () => findRecipeByName(client, 'Soup', 'Sopa'),
    Error,
    'Failed to search recipes by English name: db broke',
  );
});

// ─── Payload-capturing mock for mutation tests ──────────────────
//
// Captures the actual object passed to .insert()/.upsert() so tests can
// assert that new fields make it into the Supabase payload. Catches the
// schema-drift class of bug where an interface knows about a column but
// the function body forgot to write it.

type RecordedCall = { op: 'insert' | 'upsert'; table: string; payload: unknown };

function createPayloadCapturingMock(
  selectResults: Array<{ data?: unknown; error?: unknown | null }> = [],
): { client: SupabaseClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  let resultIdx = 0;
  const nextResult = () => {
    const r = selectResults[resultIdx++] || {};
    return { data: r.data ?? null, error: r.error ?? null };
  };

  function makeChain(table: string) {
    // deno-lint-ignore no-explicit-any
    const chain: any = {
      insert: (payload: unknown) => {
        calls.push({ op: 'insert', table, payload });
        return chain;
      },
      upsert: (payload: unknown) => {
        calls.push({ op: 'upsert', table, payload });
        return chain;
      },
      select: () => chain,
      single: () => Promise.resolve(nextResult()),
      // Make the chain awaitable — handles `await x.from(t).insert(...)` and
      // `await x.from(t).insert(...).select(...)` (both terminal forms in db.ts).
      // deno-lint-ignore no-explicit-any
      then: (resolve: any, reject?: any) =>
        Promise.resolve(nextResult()).then(resolve, reject),
    };
    return chain;
  }

  return {
    client: { from: (table: string) => makeChain(table) } as unknown as SupabaseClient,
    calls,
  };
}

Deno.test('createRecipe payload includes meal-planning fields', async () => {
  const { client, calls } = createPayloadCapturingMock([
    { data: { id: 'recipe-123' }, error: null }, // recipes insert → select('id').single()
    { error: null }, // recipe_translations insert
  ]);

  const id = await createRecipe(client, {
    name_en: 'Salad',
    name_es: 'Ensalada',
    image_url: '',
    difficulty: 'easy',
    prep_time: 5,
    total_time: 10,
    portions: 2,
    is_published: false,
    tips_and_tricks_en: '',
    tips_and_tricks_es: '',
    planner_role: 'side',
    equipment_tags: ['oven'],
    meal_components: ['veg'],
    is_complete_meal: false,
    cooking_level: 'experienced',
    leftovers_friendly: true,
    max_household_size_supported: 4,
    batch_friendly: false,
  });

  assertEquals(id, 'recipe-123');
  const recipeInsert = calls.find((c) => c.table === 'recipes');
  if (!recipeInsert) throw new Error('Expected an insert into recipes table');
  const payload = recipeInsert.payload as Record<string, unknown>;
  assertEquals(payload.planner_role, 'side');
  assertEquals(payload.equipment_tags, ['oven']);
  assertEquals(payload.meal_components, ['veg']);
  assertEquals(payload.is_complete_meal, false);
  assertEquals(payload.cooking_level, 'experienced');
  assertEquals(payload.leftovers_friendly, true);
  assertEquals(payload.max_household_size_supported, 4);
  assertEquals(payload.batch_friendly, false);
});

Deno.test('createRecipe writes null/[]/false defaults for missing meal-planning fields', async () => {
  const { client, calls } = createPayloadCapturingMock([
    { data: { id: 'recipe-456' }, error: null },
    { error: null },
  ]);

  await createRecipe(client, {
    name_en: 'A',
    name_es: 'A',
    image_url: '',
    difficulty: 'easy',
    prep_time: 0,
    total_time: 0,
    portions: 1,
    is_published: false,
  });

  const payload = calls[0].payload as Record<string, unknown>;
  assertEquals(payload.planner_role, null);
  assertEquals(payload.equipment_tags, []);
  assertEquals(payload.meal_components, []);
  assertEquals(payload.is_complete_meal, false);
  assertEquals(payload.cooking_level, null);
  assertEquals(payload.leftovers_friendly, null);
  assertEquals(payload.max_household_size_supported, null);
  assertEquals(payload.batch_friendly, null);
});

Deno.test('insertRecipeSteps payload includes thermomix_mode and timer_seconds', async () => {
  const { client, calls } = createPayloadCapturingMock([
    { data: [{ id: 'step-1', order: 1 }], error: null }, // steps insert → select('id, order')
    { error: null }, // recipe_step_translations insert
  ]);

  await insertRecipeSteps(client, [{
    recipe_id: 'r-1',
    order: 1,
    instruction_en: 'Do X',
    instruction_es: 'Haz X',
    thermomix_time: null,
    thermomix_speed: null,
    thermomix_speed_start: null,
    thermomix_speed_end: null,
    thermomix_temperature: null,
    thermomix_temperature_unit: null,
    thermomix_is_blade_reversed: null,
    thermomix_mode: 'steaming',
    timer_seconds: 600,
    recipe_section_en: 'Main',
    recipe_section_es: 'Principal',
    tip_en: '',
    tip_es: '',
  }]);

  const stepsInsert = calls.find((c) => c.table === 'recipe_steps');
  if (!stepsInsert) throw new Error('Expected an insert into recipe_steps table');
  const rows = stepsInsert.payload as Array<Record<string, unknown>>;
  assertEquals(rows.length, 1);
  assertEquals(rows[0].thermomix_mode, 'steaming');
  assertEquals(rows[0].timer_seconds, 600);
});

Deno.test('insertRecipeSteps preserves null thermomix_mode and timer_seconds', async () => {
  const { client, calls } = createPayloadCapturingMock([
    { data: [{ id: 'step-1', order: 1 }], error: null },
    { error: null },
  ]);

  await insertRecipeSteps(client, [{
    recipe_id: 'r-2',
    order: 1,
    instruction_en: 'Stir',
    instruction_es: 'Revolver',
    thermomix_time: null,
    thermomix_speed: null,
    thermomix_speed_start: null,
    thermomix_speed_end: null,
    thermomix_temperature: null,
    thermomix_temperature_unit: null,
    thermomix_is_blade_reversed: null,
    thermomix_mode: null,
    timer_seconds: null,
    recipe_section_en: 'Main',
    recipe_section_es: 'Principal',
    tip_en: '',
    tip_es: '',
  }]);

  const rows = calls[0].payload as Array<Record<string, unknown>>;
  assertEquals(rows[0].thermomix_mode, null);
  assertEquals(rows[0].timer_seconds, null);
});

Deno.test('upsertIngredientNutrition payload includes fiber, sugar, sodium', async () => {
  const { client, calls } = createPayloadCapturingMock([
    { error: null },
  ]);

  await upsertIngredientNutrition(client, 'ing-1', {
    calories: 100,
    protein: 5,
    fat: 2,
    carbohydrates: 15,
    fiber: 3,
    sugar: 8,
    sodium: 250,
    source: 'openai',
  });

  const upsertCall = calls.find((c) => c.op === 'upsert');
  if (!upsertCall) throw new Error('Expected an upsert call');
  const payload = upsertCall.payload as Record<string, unknown>;
  assertEquals(payload.fiber, 3);
  assertEquals(payload.sugar, 8);
  assertEquals(payload.sodium, 250);
  assertEquals(payload.calories, 100);
  assertEquals(payload.protein, 5);
});

Deno.test('upsertIngredientNutrition writes null for omitted micro-fields', async () => {
  const { client, calls } = createPayloadCapturingMock([
    { error: null },
  ]);

  await upsertIngredientNutrition(client, 'ing-2', {
    calories: 100,
    protein: 5,
    fat: 2,
    carbohydrates: 15,
    source: 'openai',
  });

  const payload = calls[0].payload as Record<string, unknown>;
  assertEquals(payload.fiber, null);
  assertEquals(payload.sugar, null);
  assertEquals(payload.sodium, null);
});
