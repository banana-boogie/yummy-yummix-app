import { assertEquals } from 'std/assert/mod.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { backfillSimpleEntities, backfillRecipes } from './translation-backfill.ts';
import { Logger } from './logger.ts';

// ─── Mock Infrastructure ────────────────────────────────

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

/** Track all upserted rows per table */
interface UpsertCall {
  table: string;
  rows: Row[];
}

/**
 * Create a mock Supabase client that returns pre-configured data for
 * translation table queries and records all upsert calls.
 */
function createMockSupabase(config: {
  /** Rows returned for source locale query (the entities that have 'es') */
  sourceRows?: Row[];
  /** Rows returned for target locale query (entities that already have the target) */
  targetRows?: Row[];
  /** Recipe translation row (for fetchRecipeForBackfill) */
  recipeTranslation?: Row | null;
  /** Recipe steps (for fetchRecipeForBackfill) */
  recipeSteps?: Row[];
  /** Recipe ingredients (for fetchRecipeForBackfill) */
  recipeIngredients?: Row[];
}): { client: SupabaseClient; upserts: UpsertCall[] } {
  const upserts: UpsertCall[] = [];
  let queryCount = 0;

  const makeChain = (tableName: string) => {
    const chain = {
      select: () => chain,
      eq: (_col: string, _val: string) => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => {
        return { data: config.recipeTranslation ?? null, error: null };
      },
      upsert: (rows: Row[], _opts?: Record<string, string>) => {
        upserts.push({ table: tableName, rows: Array.isArray(rows) ? rows : [rows] });
        return { error: null };
      },
      then: undefined as unknown,
    };

    // Make the chain thenable so `await supabase.from(...).select(...)...` resolves
    chain.then = (resolve: (v: unknown) => void) => {
      // Determine what data to return based on query sequence
      let data: Row[];

      if (tableName === 'recipe_steps') {
        data = config.recipeSteps || [];
      } else if (tableName === 'recipe_ingredients') {
        data = config.recipeIngredients || [];
      } else {
        // For translation table queries: first call = source rows, second = target rows
        if (queryCount === 0) {
          data = config.sourceRows || [];
        } else {
          data = config.targetRows || [];
        }
        queryCount++;
      }

      resolve({ data, error: null });
    };

    return chain;
  };

  return {
    client: {
      from: (table: string) => makeChain(table),
    } as unknown as SupabaseClient,
    upserts,
  };
}

/** Create a silent logger for tests */
function silentLogger(): Logger {
  // Logger writes to console; we just let it go to stdout — Deno.test captures it
  return new Logger('test');
}

// ─── Mock OpenAI ────────────────────────────────────────

/** Intercept fetch calls to OpenAI and return mock translated data */
function mockOpenAI(
  handler: (body: Record<string, unknown>) => Record<string, unknown>,
): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (
    input: string | URL | Request,
    _init?: RequestInit,
  ) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('api.openai.com')) {
      const body = JSON.parse((_init?.body as string) || '{}');
      const responseData = handler(body);
      return new Response(JSON.stringify({
        output_text: JSON.stringify(responseData),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return originalFetch(input, _init);
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

// ─── Tests: backfillSimpleEntities ──────────────────────

Deno.test('backfillSimpleEntities dry-run returns counts without writes', async () => {
  const { client, upserts } = createMockSupabase({
    sourceRows: [
      { ingredient_id: 'id-1', name: 'ajo', plural_name: 'ajos' },
      { ingredient_id: 'id-2', name: 'cebolla', plural_name: 'cebollas' },
    ],
    targetRows: [], // none have 'en' yet
  });

  const result = await backfillSimpleEntities(
    'ingredients',
    client,
    'fake-key',
    'en',
    silentLogger(),
    undefined,
    true, // dryRun
  );

  assertEquals(result.found, 2);
  assertEquals(result.processed, 0);
  assertEquals(upserts.length, 0); // No writes in dry-run
});

Deno.test('backfillSimpleEntities skips entities that already have target locale', async () => {
  const { client, upserts } = createMockSupabase({
    sourceRows: [
      { ingredient_id: 'id-1', name: 'ajo', plural_name: 'ajos' },
      { ingredient_id: 'id-2', name: 'cebolla', plural_name: 'cebollas' },
    ],
    targetRows: [
      { ingredient_id: 'id-1' }, // id-1 already has 'en'
    ],
  });

  const cleanup = mockOpenAI((_body) => ({
    items: [{ id: 'id-2', name: 'onion', plural_name: 'onions' }],
  }));

  try {
    const result = await backfillSimpleEntities(
      'ingredients',
      client,
      'fake-key',
      'en',
      silentLogger(),
    );

    assertEquals(result.found, 1); // Only id-2 is missing
    assertEquals(result.processed, 1);
    assertEquals(upserts.length, 1);
    assertEquals(upserts[0].rows[0].ingredient_id, 'id-2');
    assertEquals(upserts[0].rows[0].locale, 'en');
    assertEquals(upserts[0].rows[0].name, 'onion');
  } finally {
    cleanup();
  }
});

Deno.test('backfillSimpleEntities respects limit', async () => {
  const { client, upserts } = createMockSupabase({
    sourceRows: [
      { recipe_tag_id: 'tag-1', name: 'rápido' },
      { recipe_tag_id: 'tag-2', name: 'saludable' },
      { recipe_tag_id: 'tag-3', name: 'vegano' },
    ],
    targetRows: [],
  });

  const cleanup = mockOpenAI((_body) => ({
    items: [
      { id: 'tag-1', name: 'quick' },
      { id: 'tag-2', name: 'healthy' },
    ],
  }));

  try {
    const result = await backfillSimpleEntities(
      'tags',
      client,
      'fake-key',
      'en',
      silentLogger(),
      2, // limit to 2
    );

    assertEquals(result.found, 2); // limited from 3 to 2
    assertEquals(result.processed, 2);
    assertEquals(upserts.length, 1);
    assertEquals(upserts[0].rows.length, 2);
  } finally {
    cleanup();
  }
});

Deno.test('backfillSimpleEntities returns zero when nothing is missing', async () => {
  const { client, upserts } = createMockSupabase({
    sourceRows: [
      { kitchen_tool_id: 'kt-1', name: 'vaso' },
    ],
    targetRows: [
      { kitchen_tool_id: 'kt-1' }, // already has target locale
    ],
  });

  const result = await backfillSimpleEntities(
    'kitchen_tools',
    client,
    'fake-key',
    'es-ES',
    silentLogger(),
  );

  assertEquals(result.found, 0);
  assertEquals(result.processed, 0);
  assertEquals(upserts.length, 0);
});

Deno.test('backfillSimpleEntities builds correct upsert rows for es-ES', async () => {
  const { client, upserts } = createMockSupabase({
    sourceRows: [
      { kitchen_tool_id: 'kt-1', name: 'sartén' },
    ],
    targetRows: [],
  });

  const cleanup = mockOpenAI((_body) => ({
    items: [{ id: 'kt-1', name: 'sartén' }], // unchanged — neutral Spanish
  }));

  try {
    const result = await backfillSimpleEntities(
      'kitchen_tools',
      client,
      'fake-key',
      'es-ES',
      silentLogger(),
    );

    assertEquals(result.processed, 1);
    assertEquals(upserts[0].rows[0].kitchen_tool_id, 'kt-1');
    assertEquals(upserts[0].rows[0].locale, 'es-ES');
    assertEquals(upserts[0].rows[0].name, 'sartén');
  } finally {
    cleanup();
  }
});

// ─── Tests: backfillRecipes ─────────────────────────────

Deno.test('backfillRecipes dry-run returns counts without writes', async () => {
  const { client, upserts } = createMockSupabase({
    sourceRows: [
      { recipe_id: 'r-1', name: 'Sopa de ajo', tips_and_tricks: 'Tip' },
    ],
    targetRows: [],
  });

  const result = await backfillRecipes(
    client,
    'fake-key',
    'en',
    silentLogger(),
    undefined,
    true, // dryRun
  );

  assertEquals(result.found, 1);
  assertEquals(result.processed, 0);
  assertEquals(upserts.length, 0);
});

Deno.test('backfillRecipes translates recipe with steps and ingredients to en', async () => {
  // For recipes, the mock needs to handle multiple from() calls:
  // 1. recipe_translations (source) — finding missing locales
  // 2. recipe_translations (target) — checking existing
  // 3. recipe_translations — fetchRecipeForBackfill
  // 4. recipe_steps — fetchRecipeForBackfill
  // 5. recipe_ingredients — fetchRecipeForBackfill
  // 6-8. upserts

  const upserts: UpsertCall[] = [];
  let fromCallIndex = 0;

  const makeChain = (tableName: string) => {
    // deno-lint-ignore no-explicit-any
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => {
        // fetchRecipeForBackfill calls maybeSingle on recipe_translations
        return {
          data: { recipe_id: 'r-1', name: 'Sopa de ajo', tips_and_tricks: 'Usar ajo fresco' },
          error: null,
        };
      },
      upsert: (rows: Row[], _opts?: Record<string, string>) => {
        upserts.push({ table: tableName, rows: Array.isArray(rows) ? rows : [rows] });
        return { error: null };
      },
    };

    chain.then = (resolve: (v: unknown) => void) => {
      const callIdx = fromCallIndex++;
      let data: Row[];

      if (callIdx === 0) {
        // Source rows (es translations)
        data = [{ recipe_id: 'r-1', name: 'Sopa de ajo', tips_and_tricks: 'Usar ajo fresco' }];
      } else if (callIdx === 1) {
        // Target rows (no en translations yet)
        data = [];
      } else if (tableName === 'recipe_steps') {
        data = [{
          id: 'step-1',
          order: 1,
          translations: [{ locale: 'es', instruction: 'Pelar el ajo', recipe_section: '', tip: '' }],
        }];
      } else if (tableName === 'recipe_ingredients') {
        data = [{
          id: 'ri-1',
          display_order: 1,
          translations: [{ locale: 'es', notes: 'picado', tip: '', recipe_section: '' }],
        }];
      } else {
        data = [];
      }

      resolve({ data, error: null });
    };

    return chain;
  };

  const client = {
    from: (table: string) => makeChain(table),
  } as unknown as SupabaseClient;

  const cleanup = mockOpenAI((_body) => ({
    recipeName: 'Garlic Soup',
    tipsAndTricks: 'Use fresh garlic',
    steps: [{ id: 'step-1', instruction: 'Peel the garlic', section: '', tip: '' }],
    ingredientNotes: [{ id: 'ri-1', notes: 'chopped', tip: '', section: '' }],
  }));

  try {
    const result = await backfillRecipes(
      client,
      'fake-key',
      'en',
      silentLogger(),
    );

    assertEquals(result.found, 1);
    assertEquals(result.processed, 1);

    // Should have 3 upsert calls: recipe, steps, ingredient notes
    assertEquals(upserts.length, 3);

    // Recipe translation
    assertEquals(upserts[0].table, 'recipe_translations');
    assertEquals(upserts[0].rows[0].name, 'Garlic Soup');
    assertEquals(upserts[0].rows[0].locale, 'en');

    // Step translation
    assertEquals(upserts[1].table, 'recipe_step_translations');
    assertEquals(upserts[1].rows[0].instruction, 'Peel the garlic');

    // Ingredient note translation
    assertEquals(upserts[2].table, 'recipe_ingredient_translations');
    assertEquals(upserts[2].rows[0].notes, 'chopped');
  } finally {
    cleanup();
  }
});

Deno.test('backfillRecipes returns zero when no recipes are missing', async () => {
  const { client } = createMockSupabase({
    sourceRows: [{ recipe_id: 'r-1', name: 'Sopa', tips_and_tricks: '' }],
    targetRows: [{ recipe_id: 'r-1' }], // already has target
  });

  const result = await backfillRecipes(
    client,
    'fake-key',
    'en',
    silentLogger(),
  );

  assertEquals(result.found, 0);
  assertEquals(result.processed, 0);
});
