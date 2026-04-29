/**
 * Wraps the apply_recipe_metadata Postgres RPC with a typed surface.
 * The RPC's contract lives in
 * supabase/migrations/20260427050549_apply_recipe_metadata_rpc.sql.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecipeMetadata } from './recipe-metadata-schema.ts';

export interface ApplyRpcCounts {
  planner: number;
  timings: number;
  translations_upserts: number;
  translations_deletes: number;
  name_overrides: number;
  ingredient_updates: number;
  ingredient_adds: number;
  ingredient_removes: number;
  kitchen_tools_added: number;
  kitchen_tools_removed: number;
  pairings_added: number;
  pairings_removed: number;
  step_overrides: number;
  step_text_overrides: number;
  tags_added: number;
  tags_removed: number;
}

export interface ApplyRpcResult {
  ok: boolean;
  recipe_id: string;
  changed: boolean;
  counts: ApplyRpcCounts;
  errors: string[];
}

export class StaleDiffError extends Error {
  override readonly name = 'StaleDiffError';
  constructor(message: string) {
    super(message);
  }
}

export async function applyRecipeMetadata(
  supabase: SupabaseClient,
  payload: RecipeMetadata,
): Promise<ApplyRpcResult> {
  const { data, error } = await supabase.rpc('apply_recipe_metadata', { payload });
  if (error) {
    if (typeof error.message === 'string' && error.message.includes('stale_diff')) {
      throw new StaleDiffError(error.message);
    }
    throw new Error(`apply_recipe_metadata failed: ${error.message}`);
  }
  return data as ApplyRpcResult;
}

export function summariseCounts(counts: ApplyRpcCounts): string {
  const lines: string[] = [];
  for (const [key, val] of Object.entries(counts)) {
    if (val === 0) continue;
    lines.push(`  ${key}: ${val}`);
  }
  if (lines.length === 0) return '  (no rows touched)';
  return lines.join('\n');
}
