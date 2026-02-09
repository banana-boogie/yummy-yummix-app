/**
 * Database Operations
 *
 * Direct Supabase operations for the data pipeline.
 * Uses snake_case column names (no case transformation needed).
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  DbIngredient,
  DbMeasurementUnit,
  DbRecipeTag,
  DbUsefulItem,
} from './entity-matcher.ts';

// ─── Fetch All ───────────────────────────────────────────

export async function fetchAllIngredients(supabase: SupabaseClient): Promise<DbIngredient[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name_en, name_es, plural_name_en, plural_name_es, picture_url, nutritional_facts')
    .order('name_en', { ascending: true });
  if (error) throw new Error(`Failed to fetch ingredients: ${error.message}`);
  return data || [];
}

export async function fetchAllTags(supabase: SupabaseClient): Promise<DbRecipeTag[]> {
  const { data, error } = await supabase
    .from('recipe_tags')
    .select('id, name_en, name_es, categories')
    .order('name_en', { ascending: true });
  if (error) throw new Error(`Failed to fetch tags: ${error.message}`);
  return data || [];
}

export async function fetchAllUsefulItems(supabase: SupabaseClient): Promise<DbUsefulItem[]> {
  const { data, error } = await supabase
    .from('useful_items')
    .select('id, name_en, name_es, picture_url')
    .order('name_en', { ascending: true });
  if (error) throw new Error(`Failed to fetch useful items: ${error.message}`);
  return data || [];
}

export async function fetchAllMeasurementUnits(
  supabase: SupabaseClient,
): Promise<DbMeasurementUnit[]> {
  const { data, error } = await supabase
    .from('measurement_units')
    .select('id, type, system, name_en, name_es, symbol_en, symbol_es')
    .order('name_en', { ascending: true });
  if (error) throw new Error(`Failed to fetch measurement units: ${error.message}`);
  return data || [];
}

export async function fetchAllRecipes(supabase: SupabaseClient): Promise<
  Array<{
    id: string;
    name_en: string;
    name_es: string;
    picture_url: string;
    is_published: boolean;
    nutritional_facts: Record<string, unknown> | null;
  }>
> {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name_en, name_es, picture_url, is_published, nutritional_facts')
    .order('name_en', { ascending: true });
  if (error) throw new Error(`Failed to fetch recipes: ${error.message}`);
  return data || [];
}

// ─── Create Entities ─────────────────────────────────────

export async function createIngredient(
  supabase: SupabaseClient,
  ingredient: {
    name_en: string;
    name_es: string;
    plural_name_en: string;
    plural_name_es: string;
    picture_url?: string;
    nutritional_facts?: Record<string, unknown> | null;
  },
): Promise<DbIngredient> {
  const { data, error } = await supabase
    .from('ingredients')
    .insert({
      name_en: ingredient.name_en,
      name_es: ingredient.name_es,
      plural_name_en: ingredient.plural_name_en,
      plural_name_es: ingredient.plural_name_es,
      picture_url: ingredient.picture_url || '',
      nutritional_facts: ingredient.nutritional_facts || {},
    })
    .select('*')
    .single();
  if (error) {
    throw new Error(`Failed to create ingredient "${ingredient.name_en}": ${error.message}`);
  }
  return data;
}

export async function createUsefulItem(
  supabase: SupabaseClient,
  item: { name_en: string; name_es: string; picture_url?: string },
): Promise<DbUsefulItem> {
  const { data, error } = await supabase
    .from('useful_items')
    .insert({
      name_en: item.name_en,
      name_es: item.name_es,
      picture_url: item.picture_url || '',
    })
    .select('*')
    .single();
  if (error) throw new Error(`Failed to create useful item "${item.name_en}": ${error.message}`);
  return data;
}

export async function createTag(
  supabase: SupabaseClient,
  tag: { name_en: string; name_es: string; categories: string[] },
): Promise<DbRecipeTag> {
  const { data, error } = await supabase
    .from('recipe_tags')
    .insert({
      name_en: tag.name_en,
      name_es: tag.name_es,
      categories: tag.categories,
    })
    .select('*')
    .single();
  if (error) throw new Error(`Failed to create tag "${tag.name_en}": ${error.message}`);
  return data;
}

// ─── Create Recipe (with all related entities) ───────────

export interface RecipeInsertData {
  name_en: string;
  name_es: string;
  picture_url?: string;
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
  recipe_id: string;
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
  const { data, error } = await supabase
    .from('recipes')
    .insert(recipe)
    .select('id')
    .single();
  if (error) throw new Error(`Failed to create recipe "${recipe.name_en}": ${error.message}`);
  return data.id;
}

export async function insertRecipeIngredients(
  supabase: SupabaseClient,
  ingredients: RecipeIngredientInsert[],
): Promise<void> {
  if (ingredients.length === 0) return;
  const { error } = await supabase.from('recipe_ingredients').insert(ingredients);
  if (error) throw new Error(`Failed to insert recipe ingredients: ${error.message}`);
}

export async function insertRecipeSteps(
  supabase: SupabaseClient,
  steps: RecipeStepInsert[],
): Promise<Array<{ id: string; order: number }>> {
  if (steps.length === 0) return [];
  const { data, error } = await supabase
    .from('recipe_steps')
    .insert(steps)
    .select('id, order');
  if (error) throw new Error(`Failed to insert recipe steps: ${error.message}`);
  return data || [];
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
  const rows = items.map((item) => ({ recipe_id: recipeId, ...item }));
  const { error } = await supabase.from('recipe_useful_items').insert(rows);
  if (error) throw new Error(`Failed to insert recipe useful items: ${error.message}`);
}

// ─── Update Entities ─────────────────────────────────────

export async function updateIngredient(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<DbIngredient>,
): Promise<void> {
  const { error } = await supabase.from('ingredients').update(updates).eq('id', id);
  if (error) throw new Error(`Failed to update ingredient ${id}: ${error.message}`);
}

export async function updateUsefulItem(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<DbUsefulItem>,
): Promise<void> {
  const { error } = await supabase.from('useful_items').update(updates).eq('id', id);
  if (error) throw new Error(`Failed to update useful item ${id}: ${error.message}`);
}

export async function updateRecipe(
  supabase: SupabaseClient,
  id: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('recipes').update(updates).eq('id', id);
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
function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, (ch) => `\\${ch}`);
}

export async function findRecipeByName(
  supabase: SupabaseClient,
  nameEn: string,
  nameEs: string,
): Promise<string | null> {
  // Search by English name first, then Spanish name
  // Using separate .ilike() calls to avoid unsafe string interpolation in .or()
  const { data: enMatch, error: enError } = await supabase
    .from('recipes')
    .select('id')
    .ilike('name_en', escapeIlike(nameEn))
    .limit(1)
    .maybeSingle();
  if (enError) throw new Error(`Failed to search recipes by English name: ${enError.message}`);
  if (enMatch?.id) return enMatch.id;

  const { data: esMatch, error: esError } = await supabase
    .from('recipes')
    .select('id')
    .ilike('name_es', escapeIlike(nameEs))
    .limit(1)
    .maybeSingle();
  if (esError) throw new Error(`Failed to search recipes by Spanish name: ${esError.message}`);
  return esMatch?.id || null;
}
