/**
 * Database Operations
 *
 * Direct Supabase operations for the data pipeline.
 * Uses translation tables for all translatable fields (i18n schema).
 * Entity interfaces (DbIngredient, etc.) still expose name_en/name_es —
 * flattening happens here so downstream code is unchanged.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  DbIngredient,
  DbMeasurementUnit,
  DbRecipeTag,
  DbUsefulItem,
} from './entity-matcher.ts';

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const FETCH_LIMIT = 5000;

/** Warn if a query returned exactly FETCH_LIMIT rows (may be truncated) */
function warnIfTruncated(entityName: string, count: number): void {
  if (count >= FETCH_LIMIT) {
    console.warn(
      `[db] WARNING: ${entityName} query returned ${count} rows (limit: ${FETCH_LIMIT}). Data may be truncated.`,
    );
  }
}

// ─── Translation Helpers ────────────────────────────────

/** Extract a translated field from a translations array, falling back to '' */
function tr(
  translations: Array<{ locale: string; [k: string]: unknown }>,
  locale: string,
  field: string,
): string {
  const row = translations.find((t) => t.locale === locale);
  return (row?.[field] as string) || '';
}

// ─── Fetch All ───────────────────────────────────────────

export async function fetchAllIngredients(supabase: SupabaseClient): Promise<DbIngredient[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, image_url, nutritional_facts, translations:ingredient_translations(locale, name, plural_name)')
    .limit(FETCH_LIMIT);
  if (error) throw new Error(`Failed to fetch ingredients: ${error.message}`);
  warnIfTruncated('ingredients', (data || []).length);
  return (data || [])
    .map((row: Row) => {
      const t = row.translations || [];
      return {
        id: row.id,
        image_url: row.image_url,
        nutritional_facts: row.nutritional_facts,
        name_en: tr(t, 'en', 'name'),
        name_es: tr(t, 'es', 'name'),
        plural_name_en: tr(t, 'en', 'plural_name'),
        plural_name_es: tr(t, 'es', 'plural_name'),
      };
    })
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
}

export async function fetchAllTags(supabase: SupabaseClient): Promise<DbRecipeTag[]> {
  const { data, error } = await supabase
    .from('recipe_tags')
    .select('id, categories, translations:recipe_tag_translations(locale, name)')
    .limit(FETCH_LIMIT);
  if (error) throw new Error(`Failed to fetch tags: ${error.message}`);
  warnIfTruncated('tags', (data || []).length);
  return (data || [])
    .map((row: Row) => {
      const t = row.translations || [];
      return {
        id: row.id,
        categories: row.categories,
        name_en: tr(t, 'en', 'name'),
        name_es: tr(t, 'es', 'name'),
      };
    })
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
}

export async function fetchAllUsefulItems(supabase: SupabaseClient): Promise<DbUsefulItem[]> {
  const { data, error } = await supabase
    .from('useful_items')
    .select('id, image_url, translations:useful_item_translations(locale, name)')
    .limit(FETCH_LIMIT);
  if (error) throw new Error(`Failed to fetch useful items: ${error.message}`);
  warnIfTruncated('useful_items', (data || []).length);
  return (data || [])
    .map((row: Row) => {
      const t = row.translations || [];
      return {
        id: row.id,
        image_url: row.image_url,
        name_en: tr(t, 'en', 'name'),
        name_es: tr(t, 'es', 'name'),
      };
    })
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
}

export async function fetchAllMeasurementUnits(
  supabase: SupabaseClient,
): Promise<DbMeasurementUnit[]> {
  const { data, error } = await supabase
    .from('measurement_units')
    .select('id, type, system, translations:measurement_unit_translations(locale, name, symbol)')
    .limit(FETCH_LIMIT);
  if (error) throw new Error(`Failed to fetch measurement units: ${error.message}`);
  warnIfTruncated('measurement_units', (data || []).length);
  return (data || [])
    .map((row: Row) => {
      const t = row.translations || [];
      return {
        id: row.id,
        type: row.type,
        system: row.system,
        name_en: tr(t, 'en', 'name'),
        name_es: tr(t, 'es', 'name'),
        symbol_en: tr(t, 'en', 'symbol'),
        symbol_es: tr(t, 'es', 'symbol'),
      };
    })
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
}

export async function fetchAllRecipes(supabase: SupabaseClient): Promise<
  Array<{
    id: string;
    name_en: string;
    name_es: string;
    image_url: string;
    is_published: boolean;
    nutritional_facts: Record<string, unknown> | null;
  }>
> {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, image_url, is_published, nutritional_facts, translations:recipe_translations(locale, name)')
    .limit(FETCH_LIMIT);
  if (error) throw new Error(`Failed to fetch recipes: ${error.message}`);
  warnIfTruncated('recipes', (data || []).length);
  return (data || [])
    .map((row: Row) => {
      const t = row.translations || [];
      return {
        id: row.id,
        image_url: row.image_url,
        is_published: row.is_published,
        nutritional_facts: row.nutritional_facts,
        name_en: tr(t, 'en', 'name'),
        name_es: tr(t, 'es', 'name'),
      };
    })
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
}

// ─── Create Entities ─────────────────────────────────────

export async function createIngredient(
  supabase: SupabaseClient,
  ingredient: {
    name_en: string;
    name_es: string;
    plural_name_en: string;
    plural_name_es: string;
    image_url?: string;
    nutritional_facts?: Record<string, unknown> | null;
  },
): Promise<DbIngredient> {
  // 1. Insert base entity
  const { data, error } = await supabase
    .from('ingredients')
    .insert({
      image_url: ingredient.image_url || '',
      nutritional_facts: ingredient.nutritional_facts || {},
    })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to create ingredient "${ingredient.name_en}": ${error.message}`);

  // 2. Insert translations
  const { error: tErr } = await supabase
    .from('ingredient_translations')
    .insert([
      { ingredient_id: data.id, locale: 'en', name: ingredient.name_en, plural_name: ingredient.plural_name_en },
      { ingredient_id: data.id, locale: 'es', name: ingredient.name_es, plural_name: ingredient.plural_name_es },
    ]);
  if (tErr) throw new Error(`Failed to create ingredient translations: ${tErr.message}`);

  return {
    id: data.id,
    name_en: ingredient.name_en,
    name_es: ingredient.name_es,
    plural_name_en: ingredient.plural_name_en,
    plural_name_es: ingredient.plural_name_es,
    image_url: ingredient.image_url || '',
    nutritional_facts: ingredient.nutritional_facts || null,
  };
}

export async function createUsefulItem(
  supabase: SupabaseClient,
  item: { name_en: string; name_es: string; image_url?: string },
): Promise<DbUsefulItem> {
  const { data, error } = await supabase
    .from('useful_items')
    .insert({ image_url: item.image_url || '' })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to create useful item "${item.name_en}": ${error.message}`);

  const { error: tErr } = await supabase
    .from('useful_item_translations')
    .insert([
      { useful_item_id: data.id, locale: 'en', name: item.name_en },
      { useful_item_id: data.id, locale: 'es', name: item.name_es },
    ]);
  if (tErr) throw new Error(`Failed to create useful item translations: ${tErr.message}`);

  return {
    id: data.id,
    name_en: item.name_en,
    name_es: item.name_es,
    image_url: item.image_url || '',
  };
}

export async function createTag(
  supabase: SupabaseClient,
  tag: { name_en: string; name_es: string; categories: string[] },
): Promise<DbRecipeTag> {
  const { data, error } = await supabase
    .from('recipe_tags')
    .insert({ categories: tag.categories })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to create tag "${tag.name_en}": ${error.message}`);

  const { error: tErr } = await supabase
    .from('recipe_tag_translations')
    .insert([
      { recipe_tag_id: data.id, locale: 'en', name: tag.name_en },
      { recipe_tag_id: data.id, locale: 'es', name: tag.name_es },
    ]);
  if (tErr) throw new Error(`Failed to create tag translations: ${tErr.message}`);

  return {
    id: data.id,
    name_en: tag.name_en,
    name_es: tag.name_es,
    categories: tag.categories,
  };
}

// ─── Create Recipe (with all related entities) ───────────

export interface RecipeInsertData {
  name_en: string;
  name_es: string;
  image_url?: string;
  difficulty: string;
  prep_time: number;
  total_time: number;
  portions: number;
  is_published: boolean;
  tips_and_tricks_en?: string;
  tips_and_tricks_es?: string;
}

export interface RecipeIngredientInsert {
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  measurement_unit_id: string | null;
  notes_en: string;
  notes_es: string;
  tip_en: string;
  tip_es: string;
  optional: boolean;
  display_order: number;
  recipe_section_en: string;
  recipe_section_es: string;
}

export interface RecipeStepInsert {
  recipe_id: string;
  order: number;
  instruction_en: string;
  instruction_es: string;
  thermomix_time: number | null;
  thermomix_speed: number | string | null;
  thermomix_speed_start: number | string | null;
  thermomix_speed_end: number | string | null;
  thermomix_temperature: number | string | null;
  thermomix_temperature_unit: string | null;
  thermomix_is_blade_reversed: boolean | null;
  recipe_section_en: string;
  recipe_section_es: string;
  tip_en: string;
  tip_es: string;
}

export interface RecipeStepIngredientInsert {
  recipe_step_id: string;
  ingredient_id: string;
  measurement_unit_id: string | null;
  quantity: number;
  display_order: number;
  optional: boolean;
}

export async function createRecipe(
  supabase: SupabaseClient,
  recipe: RecipeInsertData,
): Promise<string> {
  // 1. Insert base recipe (non-translatable fields only)
  const { data, error } = await supabase
    .from('recipes')
    .insert({
      image_url: recipe.image_url,
      difficulty: recipe.difficulty,
      prep_time: recipe.prep_time,
      total_time: recipe.total_time,
      portions: recipe.portions,
      is_published: recipe.is_published,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to create recipe "${recipe.name_en}": ${error.message}`);

  // 2. Insert translations
  const { error: tErr } = await supabase
    .from('recipe_translations')
    .insert([
      { recipe_id: data.id, locale: 'en', name: recipe.name_en, tips_and_tricks: recipe.tips_and_tricks_en || '' },
      { recipe_id: data.id, locale: 'es', name: recipe.name_es, tips_and_tricks: recipe.tips_and_tricks_es || '' },
    ]);
  if (tErr) throw new Error(`Failed to create recipe translations: ${tErr.message}`);

  return data.id;
}

export async function insertRecipeIngredients(
  supabase: SupabaseClient,
  ingredients: RecipeIngredientInsert[],
): Promise<void> {
  if (ingredients.length === 0) return;

  // 1. Insert base rows (non-translatable fields)
  const baseRows = ingredients.map((ri) => ({
    recipe_id: ri.recipe_id,
    ingredient_id: ri.ingredient_id,
    quantity: ri.quantity,
    measurement_unit_id: ri.measurement_unit_id,
    optional: ri.optional,
    display_order: ri.display_order,
  }));

  const { data: inserted, error } = await supabase
    .from('recipe_ingredients')
    .insert(baseRows)
    .select('id, display_order');
  if (error) throw new Error(`Failed to insert recipe ingredients: ${error.message}`);

  // 2. Map display_order → inserted ID, then insert translations
  const orderToId = new Map((inserted || []).map((r: Row) => [r.display_order, r.id]));
  const translations: Row[] = [];
  for (const ri of ingredients) {
    const rowId = orderToId.get(ri.display_order);
    if (!rowId) continue;
    translations.push(
      { recipe_ingredient_id: rowId, locale: 'en', notes: ri.notes_en, tip: ri.tip_en, recipe_section: ri.recipe_section_en },
      { recipe_ingredient_id: rowId, locale: 'es', notes: ri.notes_es, tip: ri.tip_es, recipe_section: ri.recipe_section_es },
    );
  }
  if (translations.length > 0) {
    const { error: tErr } = await supabase
      .from('recipe_ingredient_translations')
      .insert(translations);
    if (tErr) throw new Error(`Failed to insert recipe ingredient translations: ${tErr.message}`);
  }
}

export async function insertRecipeSteps(
  supabase: SupabaseClient,
  steps: RecipeStepInsert[],
): Promise<Array<{ id: string; order: number }>> {
  if (steps.length === 0) return [];

  // 1. Insert base rows (thermomix params + order)
  const baseRows = steps.map((s) => ({
    recipe_id: s.recipe_id,
    order: s.order,
    thermomix_time: s.thermomix_time,
    thermomix_speed: s.thermomix_speed,
    thermomix_speed_start: s.thermomix_speed_start,
    thermomix_speed_end: s.thermomix_speed_end,
    thermomix_temperature: s.thermomix_temperature,
    thermomix_temperature_unit: s.thermomix_temperature_unit,
    thermomix_is_blade_reversed: s.thermomix_is_blade_reversed,
  }));

  const { data: inserted, error } = await supabase
    .from('recipe_steps')
    .insert(baseRows)
    .select('id, order');
  if (error) throw new Error(`Failed to insert recipe steps: ${error.message}`);

  // 2. Map order → inserted ID, then insert translations
  const orderToId = new Map((inserted || []).map((r: Row) => [r.order, r.id]));
  const translations: Row[] = [];
  for (const s of steps) {
    const rowId = orderToId.get(s.order);
    if (!rowId) continue;
    translations.push(
      { recipe_step_id: rowId, locale: 'en', instruction: s.instruction_en, recipe_section: s.recipe_section_en, tip: s.tip_en },
      { recipe_step_id: rowId, locale: 'es', instruction: s.instruction_es, recipe_section: s.recipe_section_es, tip: s.tip_es },
    );
  }
  if (translations.length > 0) {
    const { error: tErr } = await supabase
      .from('recipe_step_translations')
      .insert(translations);
    if (tErr) throw new Error(`Failed to insert recipe step translations: ${tErr.message}`);
  }

  return inserted || [];
}

export async function insertRecipeStepIngredients(
  supabase: SupabaseClient,
  stepIngredients: RecipeStepIngredientInsert[],
): Promise<void> {
  if (stepIngredients.length === 0) return;
  const { error } = await supabase.from('recipe_step_ingredients').insert(stepIngredients);
  if (error) throw new Error(`Failed to insert step ingredients: ${error.message}`);
}

export async function insertRecipeTags(
  supabase: SupabaseClient,
  recipeId: string,
  tagIds: string[],
): Promise<void> {
  if (tagIds.length === 0) return;
  const rows = tagIds.map((tagId) => ({ recipe_id: recipeId, tag_id: tagId }));
  const { error } = await supabase.from('recipe_to_tag').insert(rows);
  if (error) throw new Error(`Failed to insert recipe tags: ${error.message}`);
}

export async function insertRecipeUsefulItems(
  supabase: SupabaseClient,
  recipeId: string,
  items: Array<
    { useful_item_id: string; display_order: number; notes_en: string; notes_es: string }
  >,
): Promise<void> {
  if (items.length === 0) return;

  // 1. Insert base rows
  const baseRows = items.map((item) => ({
    recipe_id: recipeId,
    useful_item_id: item.useful_item_id,
    display_order: item.display_order,
  }));

  const { data: inserted, error } = await supabase
    .from('recipe_useful_items')
    .insert(baseRows)
    .select('id, display_order');
  if (error) throw new Error(`Failed to insert recipe useful items: ${error.message}`);

  // 2. Insert translations
  const orderToId = new Map((inserted || []).map((r: Row) => [r.display_order, r.id]));
  const translations: Row[] = [];
  for (const item of items) {
    const rowId = orderToId.get(item.display_order);
    if (!rowId) continue;
    translations.push(
      { recipe_useful_item_id: rowId, locale: 'en', notes: item.notes_en },
      { recipe_useful_item_id: rowId, locale: 'es', notes: item.notes_es },
    );
  }
  if (translations.length > 0) {
    const { error: tErr } = await supabase
      .from('recipe_useful_item_translations')
      .insert(translations);
    if (tErr) throw new Error(`Failed to insert recipe useful item translations: ${tErr.message}`);
  }
}

// ─── Update Entities ─────────────────────────────────────

/** Update non-translatable fields on an ingredient (e.g., nutritional_facts, image_url) */
export async function updateIngredient(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<DbIngredient>,
): Promise<void> {
  // Strip translation fields — only update base table columns
  const { name_en: _, name_es: _2, plural_name_en: _3, plural_name_es: _4, ...baseUpdates } =
    updates;
  if (Object.keys(baseUpdates).length === 0) return;
  const { error } = await supabase.from('ingredients').update(baseUpdates).eq('id', id);
  if (error) throw new Error(`Failed to update ingredient ${id}: ${error.message}`);
}

/** Update non-translatable fields on a useful item (e.g., image_url) */
export async function updateUsefulItem(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<DbUsefulItem>,
): Promise<void> {
  const { name_en: _, name_es: _2, ...baseUpdates } = updates;
  if (Object.keys(baseUpdates).length === 0) return;
  const { error } = await supabase.from('useful_items').update(baseUpdates).eq('id', id);
  if (error) throw new Error(`Failed to update useful item ${id}: ${error.message}`);
}

/** Update non-translatable fields on a tag (e.g., categories) */
export async function updateTag(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<DbRecipeTag>,
): Promise<void> {
  const { name_en: _, name_es: _2, ...baseUpdates } = updates;
  if (Object.keys(baseUpdates).length === 0) return;
  const { error } = await supabase.from('recipe_tags').update(baseUpdates).eq('id', id);
  if (error) throw new Error(`Failed to update tag ${id}: ${error.message}`);
}

/** Update non-translatable fields on a recipe (e.g., nutritional_facts, image_url) */
export async function updateRecipe(
  supabase: SupabaseClient,
  id: string,
  updates: Record<string, unknown>,
): Promise<void> {
  // Strip any translation fields that callers might accidentally include
  const { name_en: _, name_es: _2, tips_and_tricks_en: _3, tips_and_tricks_es: _4, ...baseUpdates } =
    updates;
  if (Object.keys(baseUpdates).length === 0) return;
  const { error } = await supabase.from('recipes').update(baseUpdates).eq('id', id);
  if (error) throw new Error(`Failed to update recipe ${id}: ${error.message}`);
}

export async function deleteRecipe(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete recipe ${id}: ${error.message}`);
}

// ─── Check Duplicates ────────────────────────────────────

/** Escape ILIKE wildcard characters (% and _) in user input */
export function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, (ch) => `\\${ch}`);
}

export async function findRecipeByName(
  supabase: SupabaseClient,
  nameEn: string,
  nameEs: string,
): Promise<string | null> {
  // Search English translation first
  const { data: enMatch, error: enError } = await supabase
    .from('recipe_translations')
    .select('recipe_id')
    .eq('locale', 'en')
    .ilike('name', escapeIlike(nameEn))
    .limit(1)
    .maybeSingle();
  if (enError) throw new Error(`Failed to search recipes by English name: ${enError.message}`);
  if (enMatch?.recipe_id) return enMatch.recipe_id;

  // Search Spanish translation
  const { data: esMatch, error: esError } = await supabase
    .from('recipe_translations')
    .select('recipe_id')
    .eq('locale', 'es')
    .ilike('name', escapeIlike(nameEs))
    .limit(1)
    .maybeSingle();
  if (esError) throw new Error(`Failed to search recipes by Spanish name: ${esError.message}`);
  return esMatch?.recipe_id || null;
}
