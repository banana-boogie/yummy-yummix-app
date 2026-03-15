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
  DbKitchenTool,
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
    .select('id, image_url, translations:ingredient_translations(locale, name, plural_name)')
    .limit(FETCH_LIMIT);
  if (error) throw new Error(`Failed to fetch ingredients: ${error.message}`);
  warnIfTruncated('ingredients', (data || []).length);
  return (data || [])
    .map((row: Row) => {
      const t = row.translations || [];
      return {
        id: row.id,
        image_url: row.image_url,
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

export async function fetchAllKitchenTools(supabase: SupabaseClient): Promise<DbKitchenTool[]> {
  const { data, error } = await supabase
    .from('kitchen_tools')
    .select('id, image_url, translations:kitchen_tool_translations(locale, name)')
    .limit(FETCH_LIMIT);
  if (error) throw new Error(`Failed to fetch kitchen tools: ${error.message}`);
  warnIfTruncated('kitchen_tools', (data || []).length);
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
  }>
> {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, image_url, is_published, translations:recipe_translations(locale, name)')
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
  },
): Promise<DbIngredient> {
  // 1. Insert base entity
  const { data, error } = await supabase
    .from('ingredients')
    .insert({
      image_url: ingredient.image_url || '',
    })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to create ingredient "${ingredient.name_en}": ${error.message}`);

  // 2. Insert translations (capitalize-first for display consistency)
  const nameEn = capitalizeFirst(ingredient.name_en.trim());
  const nameEs = capitalizeFirst(ingredient.name_es.trim());
  const pluralEn = capitalizeFirst(ingredient.plural_name_en.trim());
  const pluralEs = capitalizeFirst(ingredient.plural_name_es.trim());

  const { error: tErr } = await supabase
    .from('ingredient_translations')
    .insert([
      { ingredient_id: data.id, locale: 'en', name: nameEn, plural_name: pluralEn },
      { ingredient_id: data.id, locale: 'es', name: nameEs, plural_name: pluralEs },
    ]);
  if (tErr) throw new Error(`Failed to create ingredient translations: ${tErr.message}`);

  return {
    id: data.id,
    name_en: nameEn,
    name_es: nameEs,
    plural_name_en: pluralEn,
    plural_name_es: pluralEs,
    image_url: ingredient.image_url || '',
  };
}

/** Capitalize first letter only */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export async function createKitchenTool(
  supabase: SupabaseClient,
  item: { name_en: string; name_es: string; image_url?: string },
): Promise<DbKitchenTool> {
  // Normalize casing: capitalize first letter for both EN and ES
  const nameEn = capitalizeFirst(item.name_en.trim());
  const nameEs = capitalizeFirst(item.name_es.trim());

  const { data, error } = await supabase
    .from('kitchen_tools')
    .insert({ image_url: item.image_url || '' })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to create kitchen tool "${nameEn}": ${error.message}`);

  const { error: tErr } = await supabase
    .from('kitchen_tool_translations')
    .insert([
      { kitchen_tool_id: data.id, locale: 'en', name: nameEn },
      { kitchen_tool_id: data.id, locale: 'es', name: nameEs },
    ]);
  if (tErr) throw new Error(`Failed to create kitchen tool translations: ${tErr.message}`);

  return {
    id: data.id,
    name_en: nameEn,
    name_es: nameEs,
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
): Promise<Map<number, string>> {
  if (ingredients.length === 0) return new Map();

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

  return orderToId;
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

export async function insertRecipeKitchenTools(
  supabase: SupabaseClient,
  recipeId: string,
  items: Array<
    { kitchen_tool_id: string; display_order: number; notes_en: string; notes_es: string }
  >,
): Promise<void> {
  if (items.length === 0) return;

  // 1. Insert base rows
  const baseRows = items.map((item) => ({
    recipe_id: recipeId,
    kitchen_tool_id: item.kitchen_tool_id,
    display_order: item.display_order,
  }));

  const { data: inserted, error } = await supabase
    .from('recipe_kitchen_tools')
    .insert(baseRows)
    .select('id, display_order');
  if (error) throw new Error(`Failed to insert recipe kitchen tools: ${error.message}`);

  // 2. Insert translations
  const orderToId = new Map((inserted || []).map((r: Row) => [r.display_order, r.id]));
  const translations: Row[] = [];
  for (const item of items) {
    const rowId = orderToId.get(item.display_order);
    if (!rowId) continue;
    translations.push(
      { recipe_kitchen_tool_id: rowId, locale: 'en', notes: item.notes_en },
      { recipe_kitchen_tool_id: rowId, locale: 'es', notes: item.notes_es },
    );
  }
  if (translations.length > 0) {
    const { error: tErr } = await supabase
      .from('recipe_kitchen_tool_translations')
      .insert(translations);
    if (tErr) throw new Error(`Failed to insert recipe kitchen tool translations: ${tErr.message}`);
  }
}

// ─── Insert es-ES Translations ──────────────────────────

export interface SpainTranslations {
  recipe?: { recipeId: string; name: string; tipsAndTricks: string };
  steps?: Array<{ stepId: string; instruction: string; section: string; tip: string }>;
  ingredientNotes?: Array<{ recipeIngredientId: string; notes: string; tip: string; section: string }>;
  ingredients?: Array<{ ingredientId: string; name: string; pluralName: string }>;
  kitchenTools?: Array<{ kitchenToolId: string; name: string }>;
}

export async function insertSpainTranslations(
  supabase: SupabaseClient,
  data: SpainTranslations,
): Promise<void> {
  const locale = 'es-ES';

  // Recipe translation
  if (data.recipe) {
    const { error } = await supabase
      .from('recipe_translations')
      .upsert({
        recipe_id: data.recipe.recipeId,
        locale,
        name: data.recipe.name,
        tips_and_tricks: data.recipe.tipsAndTricks,
      }, { onConflict: 'recipe_id,locale' });
    if (error) throw new Error(`Failed to insert es-ES recipe translation: ${error.message}`);
  }

  // Step translations
  if (data.steps && data.steps.length > 0) {
    const rows = data.steps.map((s) => ({
      recipe_step_id: s.stepId,
      locale,
      instruction: s.instruction,
      recipe_section: s.section,
      tip: s.tip,
    }));
    const { error } = await supabase
      .from('recipe_step_translations')
      .upsert(rows, { onConflict: 'recipe_step_id,locale' });
    if (error) throw new Error(`Failed to insert es-ES step translations: ${error.message}`);
  }

  // Recipe ingredient translations
  if (data.ingredientNotes && data.ingredientNotes.length > 0) {
    const rows = data.ingredientNotes.map((ri) => ({
      recipe_ingredient_id: ri.recipeIngredientId,
      locale,
      notes: ri.notes,
      tip: ri.tip,
      recipe_section: ri.section,
    }));
    const { error } = await supabase
      .from('recipe_ingredient_translations')
      .upsert(rows, { onConflict: 'recipe_ingredient_id,locale' });
    if (error) throw new Error(`Failed to insert es-ES ingredient note translations: ${error.message}`);
  }

  // Ingredient translations (for newly created ingredients)
  if (data.ingredients && data.ingredients.length > 0) {
    const rows = data.ingredients.map((i) => ({
      ingredient_id: i.ingredientId,
      locale,
      name: i.name,
      plural_name: i.pluralName,
    }));
    const { error } = await supabase
      .from('ingredient_translations')
      .upsert(rows, { onConflict: 'ingredient_id,locale' });
    if (error) throw new Error(`Failed to insert es-ES ingredient translations: ${error.message}`);
  }

  // Kitchen tool translations (for newly created tools)
  if (data.kitchenTools && data.kitchenTools.length > 0) {
    const rows = data.kitchenTools.map((kt) => ({
      kitchen_tool_id: kt.kitchenToolId,
      locale,
      name: kt.name,
    }));
    const { error } = await supabase
      .from('kitchen_tool_translations')
      .upsert(rows, { onConflict: 'kitchen_tool_id,locale' });
    if (error) throw new Error(`Failed to insert es-ES kitchen tool translations: ${error.message}`);
  }
}

// ─── Update Entities ─────────────────────────────────────

/** Update non-translatable fields on an ingredient (e.g., image_url) */
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

/** Update non-translatable fields on a kitchen tool (e.g., image_url) */
export async function updateKitchenTool(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<DbKitchenTool>,
): Promise<void> {
  const { name_en: _, name_es: _2, ...baseUpdates } = updates;
  if (Object.keys(baseUpdates).length === 0) return;
  const { error } = await supabase.from('kitchen_tools').update(baseUpdates).eq('id', id);
  if (error) throw new Error(`Failed to update kitchen tool ${id}: ${error.message}`);
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

// ─── Ingredient Nutrition ─────────────────────────────────

/** Upsert a row into ingredient_nutrition */
export async function upsertIngredientNutrition(
  supabase: SupabaseClient,
  ingredientId: string,
  data: {
    calories: number;
    protein: number;
    fat: number;
    carbohydrates: number;
    source: string;
  },
): Promise<void> {
  const { error } = await supabase
    .from('ingredient_nutrition')
    .upsert({
      ingredient_id: ingredientId,
      calories: data.calories,
      protein: data.protein,
      fat: data.fat,
      carbohydrates: data.carbohydrates,
      source: data.source,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'ingredient_id' });
  if (error) throw new Error(`Failed to upsert nutrition for ${ingredientId}: ${error.message}`);
}

/** Fetch the set of ingredient IDs that already have nutrition data */
export async function fetchIngredientNutritionIds(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('ingredient_nutrition')
    .select('ingredient_id')
    .limit(FETCH_LIMIT);
  if (error) throw new Error(`Failed to fetch nutrition IDs: ${error.message}`);
  warnIfTruncated('ingredient_nutrition', (data || []).length);
  return new Set((data || []).map((r: Row) => r.ingredient_id));
}

/** Update non-translatable fields on a recipe (e.g., image_url) */
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

// ─── Backfill Queries ──────────────────────────────────

/**
 * Fetch entities that have a `sourceLocale` translation but are MISSING `targetLocale`.
 * Returns the source-locale fields so they can be translated/adapted.
 */
export async function fetchEntitiesMissingLocale(
  supabase: SupabaseClient,
  translationTable: string,
  idColumn: string,
  fields: string[],
  sourceLocale: string,
  targetLocale: string,
  limit?: number,
): Promise<Array<Record<string, string>>> {
  // Find IDs that have the source locale
  const { data: sourceRows, error: srcErr } = await supabase
    .from(translationTable)
    .select(`${idColumn}, ${fields.join(', ')}`)
    .eq('locale', sourceLocale)
    .limit(FETCH_LIMIT);
  if (srcErr) throw new Error(`Failed to fetch ${translationTable} (${sourceLocale}): ${srcErr.message}`);

  // Find IDs that already have the target locale
  const { data: targetRows, error: tgtErr } = await supabase
    .from(translationTable)
    .select(idColumn)
    .eq('locale', targetLocale)
    .limit(FETCH_LIMIT);
  if (tgtErr) throw new Error(`Failed to fetch ${translationTable} (${targetLocale}): ${tgtErr.message}`);

  const existingIds = new Set((targetRows || []).map((r: Row) => r[idColumn]));
  const missing = ((sourceRows || []) as Row[]).filter((r: Row) => !existingIds.has(r[idColumn]));

  const result = limit ? missing.slice(0, limit) : missing;
  return result as Array<Record<string, string>>;
}

/**
 * Generic upsert into any *_translations table.
 * Each row must include the id column, locale, and translatable fields.
 */
export async function upsertEntityTranslations(
  supabase: SupabaseClient,
  translationTable: string,
  idColumn: string,
  rows: Row[],
): Promise<{ skipped: number }> {
  if (rows.length === 0) return { skipped: 0 };

  // Try batch upsert first (fast path)
  const { error } = await supabase
    .from(translationTable)
    .upsert(rows, { onConflict: `${idColumn},locale` });

  if (!error) return { skipped: 0 };

  // If batch fails (e.g., unique name constraint), fall back to one-at-a-time
  let skipped = 0;
  for (const row of rows) {
    const { error: rowErr } = await supabase
      .from(translationTable)
      .upsert(row, { onConflict: `${idColumn},locale` });
    if (rowErr) {
      console.warn(
        `[db] Skipping ${translationTable} row (${row[idColumn]}, ${row.locale}): ${rowErr.message}`,
      );
      skipped++;
    }
  }
  return { skipped };
}

/**
 * Fetch a single recipe with all translatable child content for backfill.
 * Returns structured data with current es translations for steps, ingredient notes, etc.
 */
export async function fetchRecipeForBackfill(
  supabase: SupabaseClient,
  recipeId: string,
  sourceLocale: string,
): Promise<{
  recipe: { id: string; name: string; tipsAndTricks: string };
  steps: Array<{ id: string; order: number; instruction: string; section: string; tip: string }>;
  ingredientNotes: Array<{ id: string; displayOrder: number; notes: string; tip: string; section: string }>;
} | null> {
  // Recipe translation
  const { data: recipeT, error: rErr } = await supabase
    .from('recipe_translations')
    .select('recipe_id, name, tips_and_tricks')
    .eq('recipe_id', recipeId)
    .eq('locale', sourceLocale)
    .maybeSingle();
  if (rErr) throw new Error(`Failed to fetch recipe translation: ${rErr.message}`);
  if (!recipeT) return null;

  // Step translations — need step IDs, join through recipe_steps
  const { data: steps, error: sErr } = await supabase
    .from('recipe_steps')
    .select('id, order, translations:recipe_step_translations(locale, instruction, recipe_section, tip)')
    .eq('recipe_id', recipeId)
    .order('order');
  if (sErr) throw new Error(`Failed to fetch recipe steps: ${sErr.message}`);

  const stepData = (steps || []).map((s: Row) => {
    const t = (s.translations || []).find((t: Row) => t.locale === sourceLocale) ||
      (s.translations || [])[0] || {};
    return {
      id: s.id,
      order: s.order,
      instruction: t.instruction || '',
      section: t.recipe_section || '',
      tip: t.tip || '',
    };
  });

  // Recipe ingredient translations — need recipe_ingredient IDs
  const { data: ris, error: riErr } = await supabase
    .from('recipe_ingredients')
    .select('id, display_order, translations:recipe_ingredient_translations(locale, notes, tip, recipe_section)')
    .eq('recipe_id', recipeId)
    .order('display_order');
  if (riErr) throw new Error(`Failed to fetch recipe ingredients: ${riErr.message}`);

  const riData = (ris || []).map((ri: Row) => {
    const t = (ri.translations || []).find((t: Row) => t.locale === sourceLocale) ||
      (ri.translations || [])[0] || {};
    return {
      id: ri.id,
      displayOrder: ri.display_order,
      notes: t.notes || '',
      tip: t.tip || '',
      section: t.recipe_section || '',
    };
  });

  return {
    recipe: {
      id: recipeId,
      name: recipeT.name || '',
      tipsAndTricks: recipeT.tips_and_tricks || '',
    },
    steps: stepData,
    ingredientNotes: riData,
  };
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
