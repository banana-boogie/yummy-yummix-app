import { assertEquals, assertRejects } from 'std/assert/mod.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { escapeIlike, findRecipeByName } from './db.ts';

type MaybeSingleResult = {
  data?: { id: string } | null;
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
    { data: { id: 'recipe-en' }, error: null },
  ]);

  const id = await findRecipeByName(client, 'Best 50%_Soup', 'Sopa');
  assertEquals(id, 'recipe-en');
  assertEquals(patterns, ['Best 50\\%\\_Soup']);
});

Deno.test('findRecipeByName falls back to Spanish search', async () => {
  const { client, patterns } = createMockSupabase([
    { data: null, error: null },
    { data: { id: 'recipe-es' }, error: null },
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
