/**
 * Recipe Review Snapshot
 *
 * Local-first recipe review state. Exporting a snapshot captures everything the
 * `/review-recipe` skill walks during its rubric pass — recipe row, translations,
 * ingredients (+ joined ingredient translations + measurement unit), steps,
 * step translations, step ingredient links, kitchen tools (+ translations),
 * pairings, and tags — so reviewers can iterate on many recipes from a single
 * local file instead of round-tripping to Supabase per recipe.
 *
 * Snapshot files are review-only input. The live `apply-recipe-metadata` RPC
 * stale-diff guard (via `recipe_match.expected_recipe_updated_at`) remains the
 * apply-time safety boundary; snapshots never gate or shortcut writes.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const SNAPSHOT_VERSION = 2 as const;

// ───────────────── Snapshot file shape ─────────────────

export interface ReviewSnapshotFile {
  snapshot_version: typeof SNAPSHOT_VERSION;
  created_at: string;
  scope: 'published' | 'manifest';
  label: string | null;
  source: {
    environment: 'local' | 'production';
    supabase_url: string;
  };
  recipe_count: number;
  recipes: SnapshotRecipe[];
  /**
   * Manifest entries that did not resolve to exactly one recipe. Reviewers can
   * treat these as falling through to live Supabase. Empty array when scope
   * is 'published' or every manifest line resolved cleanly.
   */
  unresolved_manifest_entries: UnresolvedManifestEntry[];
  /**
   * Global taxonomy snapshotted at export time. The `/review-recipe` skill
   * reads these to validate slugs and kitchen-tool names without a live-DB
   * roundtrip per review. Re-export to refresh; otherwise falls back to live
   * Supabase queries when missing (snapshot version < 2).
   */
  taxonomy: SnapshotTaxonomy;
}

export interface SnapshotTaxonomy {
  recipe_tags: Array<{ slug: string; categories: string[] }>;
  kitchen_tool_names_en: string[];
}

export interface UnresolvedManifestEntry {
  input: string;
  reason: 'not_found' | 'ambiguous';
  matches: Array<{ id: string; name_en: string | null; name_es: string | null }>;
}

export interface ReviewSnapshotPointer {
  snapshot_file: string;
  created_at: string;
  scope: 'published' | 'manifest';
  label: string | null;
  recipe_count: number;
}

// ───────────────── Per-recipe payload ──────────────────
//
// Field names mirror the DB column names so that a reviewer reading the
// snapshot sees the same shape as the SQL queries in the Step 2 of the
// `/review-recipe` skill. Joined sub-resources (translations, measurement
// unit) are nested for ergonomic per-recipe consumption.

export interface SnapshotRecipe {
  recipe: SnapshotRecipeRow;
  translations: SnapshotRecipeTranslation[];
  ingredients: SnapshotRecipeIngredient[];
  steps: SnapshotRecipeStep[];
  kitchen_tools: SnapshotRecipeKitchenTool[];
  pairings: SnapshotRecipePairing[];
  tags: SnapshotRecipeTag[];
}

export interface SnapshotRecipeRow {
  id: string;
  /**
   * Preserved verbatim from PostgREST so that `/review-recipe` can copy it into
   * `recipe_match.expected_recipe_updated_at`. The apply RPC's stale-diff guard
   * compares against this exact value.
   */
  updated_at: string;
  is_published: boolean | null;
  planner_role: string | null;
  alternate_planner_roles: string[];
  meal_components: string[];
  is_complete_meal: boolean | null;
  equipment_tags: string[];
  cooking_level: string | null;
  leftovers_friendly: boolean | null;
  batch_friendly: boolean | null;
  max_household_size_supported: number | null;
  prep_time: number | null;
  total_time: number | null;
  portions: number | null;
  difficulty: string | null;
  image_url: string | null;
}

export interface SnapshotRecipeTranslation {
  locale: string;
  name: string | null;
  description: string | null;
  tips_and_tricks: string | null;
  scaling_notes: string | null;
}

export interface SnapshotRecipeIngredient {
  id: string;
  ingredient_id: string;
  display_order: number;
  quantity: number | null;
  optional: boolean;
  measurement_unit: SnapshotMeasurementUnit | null;
  ingredient: {
    id: string;
    image_url: string | null;
    translations: Array<{ locale: string; name: string | null; plural_name: string | null }>;
  };
  translations: Array<{
    locale: string;
    notes: string | null;
    tip: string | null;
    recipe_section: string | null;
  }>;
}

export interface SnapshotMeasurementUnit {
  id: string;
  type: string | null;
  system: string | null;
  translations: Array<{ locale: string; name: string | null; symbol: string | null }>;
}

export interface SnapshotRecipeStep {
  id: string;
  order: number;
  thermomix_time: number | null;
  thermomix_speed: string | number | null;
  thermomix_speed_start: string | number | null;
  thermomix_speed_end: string | number | null;
  thermomix_temperature: string | number | null;
  thermomix_temperature_unit: string | null;
  thermomix_mode: string | null;
  thermomix_is_blade_reversed: boolean | null;
  timer_seconds: number | null;
  translations: Array<{
    locale: string;
    instruction: string | null;
    recipe_section: string | null;
    tip: string | null;
  }>;
  step_ingredients: Array<{
    ingredient_id: string;
    display_order: number;
    quantity: number | null;
    measurement_unit_id: string | null;
    optional: boolean;
    ingredient_name_en: string | null;
    /**
     * `recipe_ingredients.id` for the same recipe and ingredient. Null when the
     * step links an ingredient absent from the recipe-level ingredient list
     * (the rubric's check #11 orphan-link case).
     */
    recipe_ingredient_id: string | null;
    recipe_ingredient_display_order: number | null;
  }>;
}

export interface SnapshotRecipeKitchenTool {
  id: string;
  kitchen_tool_id: string;
  display_order: number;
  kitchen_tool: {
    id: string;
    image_url: string | null;
    translations: Array<{ locale: string; name: string | null }>;
  };
  translations: Array<{ locale: string; notes: string | null }>;
}

export interface SnapshotRecipePairing {
  target_recipe_id: string;
  pairing_role: string;
  reason: string | null;
  target_name_en: string | null;
  target_name_es: string | null;
}

export interface SnapshotRecipeTag {
  id: string;
  slug: string | null;
  categories: string[];
  translations: Array<{ locale: string; name: string | null }>;
}

// ───────────────── Filename / pointer helpers ──────────

/**
 * Sanitise a free-form label into a filename-safe kebab segment. Lowercases,
 * replaces non-alphanumerics with `-`, collapses runs, trims leading/trailing
 * dashes, and clamps length. Returns null when the input is empty after
 * sanitisation so callers can fall back to "no label".
 */
export function sanitiseLabel(input: string | null | undefined): string | null {
  if (!input) return null;
  const cleaned = input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Format an ISO 8601 instant as a filename-safe timestamp:
 *   2026-04-28T22:45:00.123Z  →  2026-04-28T22-45-00Z
 * Seconds-precision is sufficient for ordering snapshots and avoids `:` which
 * is unsafe on some filesystems.
 */
export function formatSnapshotTimestamp(date: Date): string {
  const iso = date.toISOString();
  // 2026-04-28T22:45:00.123Z  →  2026-04-28T22-45-00Z
  return iso.replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
}

export function buildSnapshotFilename(date: Date, label: string | null): string {
  const stamp = formatSnapshotTimestamp(date);
  const sanitised = sanitiseLabel(label);
  return sanitised ? `${stamp}_${sanitised}.json` : `${stamp}.json`;
}

// ───────────────── Manifest parsing ────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ParsedManifest {
  ids: string[];
  names: string[];
  raw: string[];
}

/**
 * Parse a newline-separated manifest of recipe identifiers. Each non-comment,
 * non-blank line is classified as either a UUID (matched against `recipes.id`)
 * or a free-text name (matched against `recipe_translations.name` for `en` or
 * `es`). Blank lines and lines starting with `#` are ignored.
 */
export function parseManifest(content: string): ParsedManifest {
  const ids: string[] = [];
  const names: string[] = [];
  const raw: string[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
    raw.push(trimmed);
    if (UUID_RE.test(trimmed)) {
      ids.push(trimmed.toLowerCase());
    } else {
      names.push(trimmed);
    }
  }

  return { ids, names, raw };
}

// ───────────────── Fetch helpers ───────────────────────

interface RecipeListRow {
  id: string;
  name_en: string | null;
  name_es: string | null;
}

/**
 * Resolve a parsed manifest against the live DB. Returns the set of recipe IDs
 * that resolved unambiguously, plus a list of unresolved entries describing why
 * they failed. Used by the export CLI's `--manifest` mode.
 */
export async function resolveManifest(
  supabase: SupabaseClient,
  manifest: ParsedManifest,
): Promise<{ ids: Set<string>; unresolved: UnresolvedManifestEntry[] }> {
  const resolved = new Set<string>();
  const unresolved: UnresolvedManifestEntry[] = [];

  if (manifest.ids.length > 0) {
    const { data, error } = await supabase
      .from('recipes')
      .select('id')
      .in('id', manifest.ids);
    if (error) throw new Error(`resolve manifest IDs: ${error.message}`);
    const found = new Set((data ?? []).map((r) => (r as { id: string }).id.toLowerCase()));
    for (const id of manifest.ids) {
      if (found.has(id)) {
        resolved.add(id);
      } else {
        unresolved.push({ input: id, reason: 'not_found', matches: [] });
      }
    }
  }

  for (const name of manifest.names) {
    const matches = await findRecipesByName(supabase, name);
    if (matches.length === 0) {
      unresolved.push({ input: name, reason: 'not_found', matches: [] });
    } else if (matches.length > 1) {
      unresolved.push({ input: name, reason: 'ambiguous', matches });
    } else {
      resolved.add(matches[0].id.toLowerCase());
    }
  }

  return { ids: resolved, unresolved };
}

async function findRecipesByName(
  supabase: SupabaseClient,
  name: string,
): Promise<RecipeListRow[]> {
  const { data, error } = await supabase
    .from('recipe_translations')
    .select('recipe_id, locale, name')
    .ilike('name', name)
    .in('locale', ['en', 'es']);
  if (error) throw new Error(`manifest name lookup "${name}": ${error.message}`);
  const byId = new Map<string, RecipeListRow>();
  for (const row of (data ?? []) as Array<{ recipe_id: string; locale: string; name: string }>) {
    const existing = byId.get(row.recipe_id) ?? { id: row.recipe_id, name_en: null, name_es: null };
    if (row.locale === 'en') existing.name_en = row.name;
    if (row.locale === 'es') existing.name_es = row.name;
    byId.set(row.recipe_id, existing);
  }
  return [...byId.values()];
}

/**
 * Fetch recipe IDs to include for `--scope published`.
 */
export async function fetchPublishedRecipeIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('id')
    .eq('is_published', true)
    .order('id', { ascending: true });
  if (error) throw new Error(`fetch published recipes: ${error.message}`);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}

// ───────────────── Per-recipe snapshot fetch ───────────

export async function fetchRecipeSnapshot(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<SnapshotRecipe | null> {
  const { data: recipeRow, error: recipeErr } = await supabase
    .from('recipes')
    .select(
      'id, updated_at, is_published, planner_role, alternate_planner_roles, ' +
        'meal_components, is_complete_meal, equipment_tags, cooking_level, ' +
        'leftovers_friendly, batch_friendly, max_household_size_supported, ' +
        'prep_time, total_time, portions, difficulty, image_url',
    )
    .eq('id', recipeId)
    .maybeSingle();
  if (recipeErr) throw new Error(`fetch recipe ${recipeId}: ${recipeErr.message}`);
  if (!recipeRow) return null;

  const r = recipeRow as unknown as Partial<SnapshotRecipeRow> & { id: string; updated_at: string };

  const [translations, ingredients, steps, kitchenTools, pairings, tags] = await Promise.all([
    fetchRecipeTranslations(supabase, recipeId),
    fetchRecipeIngredients(supabase, recipeId),
    fetchRecipeSteps(supabase, recipeId),
    fetchRecipeKitchenTools(supabase, recipeId),
    fetchRecipePairings(supabase, recipeId),
    fetchRecipeTags(supabase, recipeId),
  ]);

  return {
    recipe: {
      id: r.id,
      updated_at: r.updated_at,
      is_published: r.is_published ?? null,
      planner_role: r.planner_role ?? null,
      alternate_planner_roles: r.alternate_planner_roles ?? [],
      meal_components: r.meal_components ?? [],
      is_complete_meal: r.is_complete_meal ?? null,
      equipment_tags: r.equipment_tags ?? [],
      cooking_level: r.cooking_level ?? null,
      leftovers_friendly: r.leftovers_friendly ?? null,
      batch_friendly: r.batch_friendly ?? null,
      max_household_size_supported: r.max_household_size_supported ?? null,
      prep_time: r.prep_time ?? null,
      total_time: r.total_time ?? null,
      portions: r.portions ?? null,
      difficulty: r.difficulty ?? null,
      image_url: r.image_url ?? null,
    },
    translations,
    ingredients,
    steps,
    kitchen_tools: kitchenTools,
    pairings,
    tags,
  };
}

async function fetchRecipeTranslations(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<SnapshotRecipeTranslation[]> {
  const { data, error } = await supabase
    .from('recipe_translations')
    .select('locale, name, description, tips_and_tricks, scaling_notes')
    .eq('recipe_id', recipeId);
  if (error) throw new Error(`fetch recipe_translations: ${error.message}`);
  return ((data ?? []) as unknown) as SnapshotRecipeTranslation[];
}

async function fetchRecipeIngredients(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<SnapshotRecipeIngredient[]> {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select(
      'id, ingredient_id, display_order, quantity, optional, ' +
        'measurement_unit:measurement_units(' +
        'id, type, system, translations:measurement_unit_translations(locale, name, symbol)' +
        '), ' +
        'ingredient:ingredients(' +
        'id, image_url, translations:ingredient_translations(locale, name, plural_name)' +
        '), ' +
        'translations:recipe_ingredient_translations(locale, notes, tip, recipe_section)',
    )
    .eq('recipe_id', recipeId)
    .order('display_order', { ascending: true });
  if (error) throw new Error(`fetch recipe_ingredients: ${error.message}`);
  return ((data ?? []) as unknown) as SnapshotRecipeIngredient[];
}

async function fetchRecipeSteps(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<SnapshotRecipeStep[]> {
  const { data, error } = await supabase
    .from('recipe_steps')
    .select(
      'id, order, thermomix_time, thermomix_speed, thermomix_speed_start, ' +
        'thermomix_speed_end, thermomix_temperature, thermomix_temperature_unit, ' +
        'thermomix_mode, thermomix_is_blade_reversed, timer_seconds, ' +
        'translations:recipe_step_translations(locale, instruction, recipe_section, tip)',
    )
    .eq('recipe_id', recipeId)
    .order('order', { ascending: true });
  if (error) throw new Error(`fetch recipe_steps: ${error.message}`);

  const stepRows = ((data ?? []) as unknown) as Array<
    Omit<SnapshotRecipeStep, 'step_ingredients'> & { id: string }
  >;

  // Step ingredients are joined separately so we can compute the
  // recipe_ingredient_id back-reference (the rubric's orphan-link check).
  const stepIds = stepRows.map((s) => s.id);
  const stepIngByStepId = stepIds.length === 0
    ? new Map<string, SnapshotRecipeStep['step_ingredients']>()
    : await fetchStepIngredients(supabase, recipeId, stepIds);

  return stepRows.map((s) => ({
    ...s,
    step_ingredients: stepIngByStepId.get(s.id) ?? [],
  }));
}

async function fetchStepIngredients(
  supabase: SupabaseClient,
  recipeId: string,
  stepIds: string[],
): Promise<Map<string, SnapshotRecipeStep['step_ingredients']>> {
  const { data, error } = await supabase
    .from('recipe_step_ingredients')
    .select(
      'recipe_step_id, ingredient_id, display_order, quantity, ' +
        'measurement_unit_id, optional, ' +
        'ingredient:ingredients(translations:ingredient_translations(locale, name))',
    )
    .in('recipe_step_id', stepIds);
  if (error) throw new Error(`fetch recipe_step_ingredients: ${error.message}`);

  // Build a map of recipe-level ingredient_id → recipe_ingredients.id for the
  // orphan-link cross-reference. This is the same join the rubric's check #11
  // SQL produces.
  const { data: riData, error: riErr } = await supabase
    .from('recipe_ingredients')
    .select('id, ingredient_id, display_order')
    .eq('recipe_id', recipeId);
  if (riErr) throw new Error(`fetch recipe_ingredients (for step xref): ${riErr.message}`);
  const recipeIngByIngredientId = new Map<string, { id: string; display_order: number }>();
  for (
    const row of (riData ?? []) as Array<
      { id: string; ingredient_id: string; display_order: number }
    >
  ) {
    recipeIngByIngredientId.set(row.ingredient_id, {
      id: row.id,
      display_order: row.display_order,
    });
  }

  const grouped = new Map<string, SnapshotRecipeStep['step_ingredients']>();
  type Row = {
    recipe_step_id: string;
    ingredient_id: string;
    display_order: number;
    quantity: number | null;
    measurement_unit_id: string | null;
    optional: boolean;
    ingredient: { translations?: Array<{ locale: string; name: string | null }> } | null;
  };
  for (const row of ((data ?? []) as unknown) as Row[]) {
    const enName = row.ingredient?.translations?.find((t) => t.locale === 'en')?.name ?? null;
    const xref = recipeIngByIngredientId.get(row.ingredient_id);
    const list = grouped.get(row.recipe_step_id) ?? [];
    list.push({
      ingredient_id: row.ingredient_id,
      display_order: row.display_order,
      quantity: row.quantity,
      measurement_unit_id: row.measurement_unit_id,
      optional: row.optional,
      ingredient_name_en: enName,
      recipe_ingredient_id: xref?.id ?? null,
      recipe_ingredient_display_order: xref?.display_order ?? null,
    });
    grouped.set(row.recipe_step_id, list);
  }

  // Stable order: by display_order within each step.
  for (const list of grouped.values()) {
    list.sort((a, b) => a.display_order - b.display_order);
  }

  return grouped;
}

async function fetchRecipeKitchenTools(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<SnapshotRecipeKitchenTool[]> {
  const { data, error } = await supabase
    .from('recipe_kitchen_tools')
    .select(
      'id, kitchen_tool_id, display_order, ' +
        'kitchen_tool:kitchen_tools(' +
        'id, image_url, translations:kitchen_tool_translations(locale, name)' +
        '), ' +
        'translations:recipe_kitchen_tool_translations(locale, notes)',
    )
    .eq('recipe_id', recipeId)
    .order('display_order', { ascending: true });
  if (error) throw new Error(`fetch recipe_kitchen_tools: ${error.message}`);
  return ((data ?? []) as unknown) as SnapshotRecipeKitchenTool[];
}

async function fetchRecipePairings(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<SnapshotRecipePairing[]> {
  const { data, error } = await supabase
    .from('recipe_pairings')
    .select(
      'target_recipe_id, pairing_role, reason, ' +
        'target:recipes!recipe_pairings_target_recipe_id_fkey(' +
        'translations:recipe_translations(locale, name))',
    )
    .eq('source_recipe_id', recipeId);
  if (error) throw new Error(`fetch recipe_pairings: ${error.message}`);
  type Row = {
    target_recipe_id: string;
    pairing_role: string;
    reason: string | null;
    target: { translations?: Array<{ locale: string; name: string | null }> } | null;
  };
  return (((data ?? []) as unknown) as Row[]).map((row) => ({
    target_recipe_id: row.target_recipe_id,
    pairing_role: row.pairing_role,
    reason: row.reason,
    target_name_en: row.target?.translations?.find((t) => t.locale === 'en')?.name ?? null,
    target_name_es: row.target?.translations?.find((t) => t.locale === 'es')?.name ?? null,
  }));
}

/**
 * Fetch the global taxonomy lists the `/review-recipe` skill validates against
 * (canonical `recipe_tags.slug` rows and EN-locale `kitchen_tools.name` strings).
 * Snapshotting these eliminates the per-review live-DB roundtrip and prevents
 * typo'd slugs from sneaking into YAMLs.
 */
export async function fetchTaxonomy(supabase: SupabaseClient): Promise<SnapshotTaxonomy> {
  const [tagsRes, toolsRes] = await Promise.all([
    supabase.from('recipe_tags').select('slug, categories').order('slug', { ascending: true }),
    supabase
      .from('kitchen_tool_translations')
      .select('name')
      .eq('locale', 'en')
      .order('name', { ascending: true }),
  ]);

  if (tagsRes.error) throw new Error(`fetch recipe_tags taxonomy: ${tagsRes.error.message}`);
  if (toolsRes.error) {
    throw new Error(`fetch kitchen_tool_translations taxonomy: ${toolsRes.error.message}`);
  }

  const recipe_tags =
    ((tagsRes.data ?? []) as Array<{ slug: string | null; categories: string[] | null }>)
      .filter((r): r is { slug: string; categories: string[] | null } => typeof r.slug === 'string')
      .map((r) => ({ slug: r.slug, categories: r.categories ?? [] }));

  const kitchen_tool_names_en = ((toolsRes.data ?? []) as Array<{ name: string | null }>)
    .map((r) => r.name)
    .filter((n): n is string => typeof n === 'string' && n.length > 0);

  return { recipe_tags, kitchen_tool_names_en };
}

async function fetchRecipeTags(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<SnapshotRecipeTag[]> {
  const { data, error } = await supabase
    .from('recipe_to_tag')
    .select(
      'tag:recipe_tags(id, slug, categories, translations:recipe_tag_translations(locale, name))',
    )
    .eq('recipe_id', recipeId);
  if (error) throw new Error(`fetch recipe_to_tag: ${error.message}`);
  type Row = {
    tag: SnapshotRecipeTag | null;
  };
  return (((data ?? []) as unknown) as Row[])
    .map((row) => row.tag)
    .filter((t): t is SnapshotRecipeTag => t !== null);
}
