/**
 * Integration tests for the apply_recipe_metadata RPC.
 *
 * These exercise the live RPC against a real Postgres database. They require
 * service-role credentials and a designated test recipe that is safe to
 * read but should NOT be mutated outside of the test's own transactions.
 *
 * Tests are SKIPPED by default. To run:
 *
 *   RECIPE_METADATA_INTEGRATION_TEST_RECIPE_ID='<uuid>' \
 *   RECIPE_METADATA_INTEGRATION_TEST_RECIPE_NAME_EN='<live name_en>' \
 *   SUPABASE_URL='...' \
 *   SUPABASE_SERVICE_ROLE_KEY='...' \
 *   deno test --allow-net --allow-env data-pipeline/lib/recipe-metadata-apply.integration.test.ts
 *
 * Each test sends a payload that produces zero writes (the RPC's idempotency
 * gating means a no-op YAML against a stable row leaves the DB untouched).
 *
 * Coverage (all non-mutating against the test recipe):
 *   - Happy-path no-op apply returns ok=true, changed=false, all counts zero.
 *   - Stale-diff guard fires when expected_recipe_updated_at is in the past.
 *   - Missing recipe id raises a clear error.
 *   - delete_locales=['en'] is refused.
 *   - New tag categories (`dish_type`, `primary_ingredient`) round-trip
 *     against the recipe's existing tag state with no diff.
 *
 * Mutating regression tests for the two SQL bug fixes (translation bootstrap,
 * step speed/range clearing) are NOT yet implemented — they require a
 * sandbox/test database with a controllable seed state. See the comment at
 * the bottom of this file for the test plan that should be implemented when
 * that harness is built.
 */

import { assert, assertEquals, assertRejects } from 'std/assert/mod.ts';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  applyRecipeMetadata,
  StaleDiffError,
} from './recipe-metadata-apply.ts';

const TEST_RECIPE_ID = Deno.env.get('RECIPE_METADATA_INTEGRATION_TEST_RECIPE_ID') ?? '';
const TEST_RECIPE_NAME_EN =
  Deno.env.get('RECIPE_METADATA_INTEGRATION_TEST_RECIPE_NAME_EN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const isConfigured = Boolean(
  TEST_RECIPE_ID && TEST_RECIPE_NAME_EN && SUPABASE_URL && SERVICE_ROLE_KEY,
);

function client(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function fetchUpdatedAt(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from('recipes')
    .select('updated_at')
    .eq('id', TEST_RECIPE_ID)
    .single();
  if (error || !data) throw new Error(`fetchUpdatedAt: ${error?.message}`);
  return (data as { updated_at: string }).updated_at;
}

Deno.test({
  name: 'integration: no-op apply produces zero writes',
  ignore: !isConfigured,
  fn: async () => {
    const supabase = client();
    const updatedAt = await fetchUpdatedAt(supabase);
    const result = await applyRecipeMetadata(supabase, {
      recipe_match: {
        id: TEST_RECIPE_ID,
        name_en: TEST_RECIPE_NAME_EN,
        expected_recipe_updated_at: updatedAt,
      },
      review: {
        reviewed_by_label: 'integration-test',
        reviewed_at: new Date().toISOString(),
      },
    });
    // Recipe name_en may not match; if so, RPC raises and assertRejects
    // would have been needed. For this idempotency test, accept whichever:
    // either the result is changed=false, or an early validation error.
    assertEquals(result.changed, false);
    assertEquals(result.counts.planner, 0);
    assertEquals(result.counts.tags_added, 0);
    assertEquals(result.counts.tags_removed, 0);
  },
});

Deno.test({
  name: 'integration: stale-diff guard fires for past expected timestamp',
  ignore: !isConfigured,
  fn: async () => {
    const supabase = client();
    await assertRejects(
      () =>
        applyRecipeMetadata(supabase, {
          recipe_match: {
            id: TEST_RECIPE_ID,
            name_en: TEST_RECIPE_NAME_EN,
            expected_recipe_updated_at: '2020-01-01T00:00:00.000Z',
          },
          review: {
            reviewed_by_label: 'integration-test',
            reviewed_at: new Date().toISOString(),
          },
          // include a real diff so the RPC actually executes the guard
          timings: { prep_time: 999_999 },
        }),
      StaleDiffError,
    );
  },
});

Deno.test({
  name: 'integration: missing recipe id is rejected',
  ignore: !isConfigured,
  fn: async () => {
    const supabase = client();
    let raised = false;
    try {
      await applyRecipeMetadata(supabase, {
        recipe_match: {
          id: '00000000-0000-0000-0000-000000000000',
          name_en: 'NotARealRecipe',
          expected_recipe_updated_at: new Date().toISOString(),
        },
        review: {
          reviewed_by_label: 'integration-test',
          reviewed_at: new Date().toISOString(),
        },
      });
    } catch (e) {
      raised = true;
      assert(e instanceof Error);
      assert(
        /not found/i.test(e.message),
        `expected 'not found' error, got: ${e.message}`,
      );
    }
    assert(raised, 'expected RPC to raise for missing recipe');
  },
});

Deno.test({
  name: 'integration: cleanup.delete_locales refuses base "en"',
  ignore: !isConfigured,
  fn: async () => {
    const supabase = client();
    const updatedAt = await fetchUpdatedAt(supabase);
    let raised = false;
    try {
      await applyRecipeMetadata(supabase, {
        recipe_match: {
          id: TEST_RECIPE_ID,
          name_en: TEST_RECIPE_NAME_EN,
          expected_recipe_updated_at: updatedAt,
        },
        review: {
          reviewed_by_label: 'integration-test',
          reviewed_at: new Date().toISOString(),
        },
        cleanup: { delete_locales: ['en'] },
      });
    } catch (e) {
      raised = true;
      assert(e instanceof Error);
      assert(
        /refusing to delete base locale/i.test(e.message),
        `expected refusal of 'en' deletion, got: ${e.message}`,
      );
    }
    assert(raised, 'expected RPC to refuse en locale deletion');
  },
});

// ============================================================
// Coverage of the bug fixes from PR #55 fix commit (14b553c8).
// ============================================================

/**
 * Fetch current dish_type / primary_ingredient tag slugs for the test recipe.
 * Returns the tag-set arrays the RPC expects.
 */
async function fetchCurrentTrackHTags(
  supabase: SupabaseClient,
): Promise<{ dish_type: string[]; primary_ingredient: string[] }> {
  const { data, error } = await supabase
    .from('recipe_to_tag')
    .select('recipe_tags!inner(slug, categories)')
    .eq('recipe_id', TEST_RECIPE_ID);
  if (error) throw new Error(`fetchCurrentTrackHTags: ${error.message}`);

  const rows = (data as unknown) as Array<{
    recipe_tags: { slug: string; categories: string[] };
  }>;
  const dish_type: string[] = [];
  const primary_ingredient: string[] = [];
  for (const row of rows) {
    const cats = row.recipe_tags?.categories ?? [];
    if (cats.includes('dish_type')) dish_type.push(row.recipe_tags.slug);
    if (cats.includes('primary_ingredient')) primary_ingredient.push(row.recipe_tags.slug);
  }
  return { dish_type, primary_ingredient };
}

Deno.test({
  name: 'integration: dish_type and primary_ingredient categories round-trip (no-op)',
  ignore: !isConfigured,
  fn: async () => {
    // Genuinely non-mutating: read current Track H tag state, hand the same
    // arrays back to the RPC, expect the idempotency gate to detect zero
    // diff. If we sent empty arrays the RPC would DELETE existing tags in
    // those categories — that is a mutation and would deserve the gate.
    const supabase = client();
    const updatedAt = await fetchUpdatedAt(supabase);
    const current = await fetchCurrentTrackHTags(supabase);

    const result = await applyRecipeMetadata(supabase, {
      recipe_match: {
        id: TEST_RECIPE_ID,
        name_en: TEST_RECIPE_NAME_EN,
        expected_recipe_updated_at: updatedAt,
      },
      review: {
        reviewed_by_label: 'integration-test',
        reviewed_at: new Date().toISOString(),
      },
      tags: {
        dish_type: current.dish_type,
        primary_ingredient: current.primary_ingredient,
      },
    });

    assert(result.ok, 'expected RPC to accept dish_type/primary_ingredient categories');
    // The strongest "non-mutating" assertion: the RPC's own changed flag.
    // If this is false, no UPDATE on recipes.updated_at fired either.
    assertEquals(result.changed, false, 'expected no recipe mutation');
    assertEquals(result.counts.tags_added, 0, 'expected no tag inserts');
    assertEquals(result.counts.tags_removed, 0, 'expected no tag deletes');
  },
});

// ------------------------------------------------------------
// Mutating regression coverage — NOT YET IMPLEMENTED.
//
// The fixes for translation bootstrap and step speed/range clearing are not
// covered by automated regression tests yet. Implementing them requires
// either a sandbox/test database with a controllable seed state, or a way
// to wrap the RPC call in a transaction that rolls back. Neither is set up
// here, so registering throw-stub tests would be a lie about coverage
// (it would also break CI if anyone enabled the mutating suite).
//
// Test plan for follow-up work:
//
//   * `translation bootstrap inserts a missing locale`
//     1. Seed a sandbox recipe with only an `en` translation row.
//     2. Apply a payload with `name.es` + `description.es`.
//     3. Re-fetch and assert the `es` row exists with the expected values.
//     4. Reset (delete the inserted `es` row).
//
//   * `setting thermomix_speed clears thermomix_speed_range`
//     1. Seed a step with `thermomix_speed_start` and `_end` set, speed NULL.
//     2. Apply a payload with `thermomix_speed: 5`.
//     3. Re-fetch and assert `thermomix_speed='5'` and start/end are NULL.
//     4. Reset (restore previous values).
//
//   * `setting thermomix_speed_range clears thermomix_speed`
//     Symmetric to the above.
//
// Track these in a follow-up issue once the test harness exists.
// ------------------------------------------------------------
