/**
 * Fetch current recipe state for the apply-recipe-metadata CLI diff engine.
 * Read-only: no mutations. Mirrors what `apply_recipe_metadata` reads on the
 * server, so the CLI's dry-run preview is faithful to what the RPC will see.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface CurrentRecipeState {
  recipe_id: string;
  updated_at: string;
  name_en: string | null;
  planner: PlannerSnapshot;
  timings: TimingsSnapshot;
  translations: TranslationSnapshot[];
  ingredients: IngredientSnapshot[];
  steps: StepSnapshot[];
  kitchen_tools: KitchenToolSnapshot[];
  pairings: PairingSnapshot[];
  tags_by_category: Record<string, string[]>;
  /**
   * Row counts at the three translation layers, keyed by locale. Used by the
   * cleanup-section diff renderer to show what `delete_locales` will actually
   * remove. Recipe-scoped only — recipe_translations is one row per recipe,
   * step/ingredient translations are joined back to this recipe's children.
   */
  translation_counts_by_locale: Record<
    string,
    { recipe: number; steps: number; ingredients: number }
  >;
}

export interface PlannerSnapshot {
  planner_role: string | null;
  alternate_planner_roles: string[];
  meal_components: string[];
  is_complete_meal: boolean | null;
  equipment_tags: string[];
  cooking_level: string | null;
  leftovers_friendly: boolean | null;
  batch_friendly: boolean | null;
  max_household_size_supported: number | null;
  is_published: boolean | null;
}

export interface TimingsSnapshot {
  prep_time: number | null;
  total_time: number | null;
  portions: number | null;
}

export interface TranslationSnapshot {
  locale: string;
  name: string | null;
  description: string | null;
  tips_and_tricks: string | null;
  scaling_notes: string | null;
}

export interface IngredientSnapshot {
  id: string;
  ingredient_id: string;
  display_order: number;
  measurement_unit_id: string | null;
  quantity: number | null;
  optional: boolean;
  name_en: string;
  /** Stable slug derived from name_en — what the YAML's `ingredient_slug` matches against. */
  slug: string;
}

export interface StepSnapshot {
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
  /**
   * Per-locale text for this step (instruction / recipe_section / tip), one
   * entry per locale present in `recipe_step_translations`. Required for the
   * `step_text_overrides` diff so the dry-run can show the user what text
   * the apply will overwrite.
   */
  translations: StepTextSnapshot[];
}

export interface StepTextSnapshot {
  locale: string;
  instruction: string | null;
  recipe_section: string | null;
  tip: string | null;
}

export interface KitchenToolSnapshot {
  recipe_kitchen_tool_id: string;
  kitchen_tool_id: string;
  name_en: string;
  display_order: number;
  notes_en: string | null;
  notes_es: string | null;
}

export interface PairingSnapshot {
  target_recipe_id: string;
  pairing_role: string;
  target_name_en: string | null;
  reason: string | null;
}

/**
 * Reproduces the slugify logic from migration 20260427050549.
 * MUST stay in sync with public._recipe_metadata_slugify().
 */
export function slugifyName(input: string | null | undefined): string {
  if (!input) return '';
  const accentMap: Record<string, string> = {
    'Á': 'A',
    'É': 'E',
    'Í': 'I',
    'Ó': 'O',
    'Ú': 'U',
    'Ü': 'U',
    'Ñ': 'N',
    'á': 'a',
    'é': 'e',
    'í': 'i',
    'ó': 'o',
    'ú': 'u',
    'ü': 'u',
    'ñ': 'n',
  };
  return input
    .split('')
    .map((c) => accentMap[c] ?? c)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function fetchCurrentRecipeState(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<CurrentRecipeState> {
  const { data: recipe, error: recipeErr } = await supabase
    .from('recipes')
    .select(
      'id, updated_at, planner_role, alternate_planner_roles, meal_components, ' +
        'is_complete_meal, equipment_tags, cooking_level, leftovers_friendly, ' +
        'batch_friendly, max_household_size_supported, is_published, ' +
        'prep_time, total_time, portions',
    )
    .eq('id', recipeId)
    .maybeSingle();
  if (recipeErr) throw new Error(`fetch recipe: ${recipeErr.message}`);
  if (!recipe) throw new Error(`recipe ${recipeId} not found`);
  const r = recipe as unknown as {
    id: string;
    updated_at: string;
    planner_role: string | null;
    alternate_planner_roles: string[] | null;
    meal_components: string[] | null;
    is_complete_meal: boolean | null;
    equipment_tags: string[] | null;
    cooking_level: string | null;
    leftovers_friendly: boolean | null;
    batch_friendly: boolean | null;
    max_household_size_supported: number | null;
    is_published: boolean | null;
    prep_time: number | null;
    total_time: number | null;
    portions: number | null;
  };

  const [
    translations,
    ingredients,
    steps,
    kitchenTools,
    pairings,
    tags,
    translationCounts,
  ] = await Promise.all([
    fetchTranslations(supabase, recipeId),
    fetchIngredients(supabase, recipeId),
    fetchSteps(supabase, recipeId),
    fetchKitchenTools(supabase, recipeId),
    fetchPairings(supabase, recipeId),
    fetchTagsByCategory(supabase, recipeId),
    fetchTranslationCountsByLocale(supabase, recipeId),
  ]);

  const enName = translations.find((t) => t.locale === 'en')?.name ?? null;

  return {
    recipe_id: r.id,
    updated_at: r.updated_at,
    name_en: enName,
    planner: {
      planner_role: r.planner_role,
      alternate_planner_roles: r.alternate_planner_roles ?? [],
      meal_components: r.meal_components ?? [],
      is_complete_meal: r.is_complete_meal,
      equipment_tags: r.equipment_tags ?? [],
      cooking_level: r.cooking_level,
      leftovers_friendly: r.leftovers_friendly,
      batch_friendly: r.batch_friendly,
      max_household_size_supported: r.max_household_size_supported,
      is_published: r.is_published,
    },
    timings: {
      prep_time: r.prep_time,
      total_time: r.total_time,
      portions: r.portions,
    },
    translations,
    ingredients,
    steps,
    kitchen_tools: kitchenTools,
    pairings,
    tags_by_category: tags,
    translation_counts_by_locale: translationCounts,
  };
}

async function fetchTranslationCountsByLocale(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<CurrentRecipeState['translation_counts_by_locale']> {
  const counts: CurrentRecipeState['translation_counts_by_locale'] = {};
  const bump = (locale: string, key: 'recipe' | 'steps' | 'ingredients') => {
    counts[locale] ??= { recipe: 0, steps: 0, ingredients: 0 };
    counts[locale][key] += 1;
  };

  const [recipeRows, stepRows, ingRows] = await Promise.all([
    supabase
      .from('recipe_translations')
      .select('locale')
      .eq('recipe_id', recipeId),
    supabase
      .from('recipe_step_translations')
      .select('locale, recipe_steps!inner(recipe_id)')
      .eq('recipe_steps.recipe_id', recipeId),
    supabase
      .from('recipe_ingredient_translations')
      .select('locale, recipe_ingredients!inner(recipe_id)')
      .eq('recipe_ingredients.recipe_id', recipeId),
  ]);

  if (recipeRows.error) throw new Error(`fetch recipe locales: ${recipeRows.error.message}`);
  if (stepRows.error) throw new Error(`fetch step locales: ${stepRows.error.message}`);
  if (ingRows.error) throw new Error(`fetch ingredient locales: ${ingRows.error.message}`);

  for (const r of recipeRows.data ?? []) bump((r as { locale: string }).locale, 'recipe');
  for (const r of stepRows.data ?? []) bump((r as { locale: string }).locale, 'steps');
  for (const r of ingRows.data ?? []) bump((r as { locale: string }).locale, 'ingredients');

  return counts;
}

async function fetchTranslations(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<TranslationSnapshot[]> {
  const { data, error } = await supabase
    .from('recipe_translations')
    .select('locale, name, description, tips_and_tricks, scaling_notes')
    .eq('recipe_id', recipeId);
  if (error) throw new Error(`fetch translations: ${error.message}`);
  return ((data ?? []) as unknown) as TranslationSnapshot[];
}

interface IngredientRow {
  id: string;
  ingredient_id: string;
  display_order: number;
  measurement_unit_id: string | null;
  quantity: number | null;
  optional: boolean;
  ingredient: { translations: { locale: string; name: string }[] } | null;
}

async function fetchIngredients(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<IngredientSnapshot[]> {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select(
      'id, ingredient_id, display_order, measurement_unit_id, quantity, optional, ' +
        'ingredient:ingredients(translations:ingredient_translations(locale, name))',
    )
    .eq('recipe_id', recipeId)
    .order('display_order', { ascending: true });
  if (error) throw new Error(`fetch recipe_ingredients: ${error.message}`);
  return (((data ?? []) as unknown) as IngredientRow[]).map((row) => {
    const enName = row.ingredient?.translations?.find((t) => t.locale === 'en')?.name ?? '';
    return {
      id: row.id,
      ingredient_id: row.ingredient_id,
      display_order: row.display_order,
      measurement_unit_id: row.measurement_unit_id,
      quantity: row.quantity,
      optional: row.optional,
      name_en: enName,
      slug: slugifyName(enName),
    };
  });
}

async function fetchSteps(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<StepSnapshot[]> {
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
  type Row = Omit<StepSnapshot, 'translations'> & {
    translations: StepTextSnapshot[] | null;
  };
  return (((data ?? []) as unknown) as Row[]).map((s) => ({
    ...s,
    translations: (s.translations ?? []).map((t) => ({
      locale: t.locale,
      instruction: t.instruction ?? null,
      recipe_section: t.recipe_section ?? null,
      tip: t.tip ?? null,
    })),
  }));
}

interface KitchenToolRow {
  id: string;
  kitchen_tool_id: string;
  display_order: number;
  kitchen_tool: { translations: { locale: string; name: string }[] } | null;
  translations: { locale: string; notes: string | null }[] | null;
}

async function fetchKitchenTools(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<KitchenToolSnapshot[]> {
  const { data, error } = await supabase
    .from('recipe_kitchen_tools')
    .select(
      'id, kitchen_tool_id, display_order, ' +
        'kitchen_tool:kitchen_tools(translations:kitchen_tool_translations(locale, name)), ' +
        'translations:recipe_kitchen_tool_translations(locale, notes)',
    )
    .eq('recipe_id', recipeId)
    .order('display_order', { ascending: true });
  if (error) throw new Error(`fetch recipe_kitchen_tools: ${error.message}`);
  return (((data ?? []) as unknown) as KitchenToolRow[]).map((row) => ({
    recipe_kitchen_tool_id: row.id,
    kitchen_tool_id: row.kitchen_tool_id,
    display_order: row.display_order,
    name_en: row.kitchen_tool?.translations?.find((t) => t.locale === 'en')?.name ?? '',
    notes_en: row.translations?.find((t) => t.locale === 'en')?.notes ?? null,
    notes_es: row.translations?.find((t) => t.locale === 'es')?.notes ?? null,
  }));
}

interface PairingRow {
  target_recipe_id: string;
  pairing_role: string;
  reason: string | null;
  target: { translations: { locale: string; name: string }[] } | null;
}

async function fetchPairings(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<PairingSnapshot[]> {
  const { data, error } = await supabase
    .from('recipe_pairings')
    .select(
      'target_recipe_id, pairing_role, reason, ' +
        'target:recipes!recipe_pairings_target_recipe_id_fkey(' +
        'translations:recipe_translations(locale, name))',
    )
    .eq('source_recipe_id', recipeId);
  if (error) throw new Error(`fetch recipe_pairings: ${error.message}`);
  return (((data ?? []) as unknown) as PairingRow[]).map((row) => ({
    target_recipe_id: row.target_recipe_id,
    pairing_role: row.pairing_role,
    target_name_en: row.target?.translations?.find((t) => t.locale === 'en')?.name ?? null,
    reason: row.reason,
  }));
}

interface TagRow {
  tag: { slug: string | null; categories: string[] } | null;
}

async function fetchTagsByCategory(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from('recipe_to_tag')
    .select('tag:recipe_tags(slug, categories)')
    .eq('recipe_id', recipeId);
  if (error) throw new Error(`fetch recipe_to_tag: ${error.message}`);
  const grouped: Record<string, string[]> = {};
  for (const row of (((data ?? []) as unknown) as TagRow[])) {
    const slug = row.tag?.slug ?? null;
    if (!slug) continue;
    for (const category of row.tag?.categories ?? []) {
      grouped[category] ??= [];
      if (!grouped[category].includes(slug)) grouped[category].push(slug);
    }
  }
  return grouped;
}
