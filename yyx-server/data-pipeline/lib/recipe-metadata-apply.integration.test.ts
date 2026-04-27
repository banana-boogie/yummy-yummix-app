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
 * Coverage:
 *   - Happy-path no-op apply returns ok=true, changed=false, all counts zero.
 *   - Stale-diff guard fires when expected_recipe_updated_at is in the past.
 *   - Missing recipe id raises a clear error.
 *   - delete_locales=['en'] is refused.
 *
 * Anything destructive (insert/update/delete real data) belongs in a separate
 * harness that runs inside an explicit transaction with rollback.
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

// All tests below skip themselves if env is not configured. Without this,
// running `deno task test` from a developer machine without the env vars
// would fail.
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
