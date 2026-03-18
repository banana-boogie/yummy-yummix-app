import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';
import { pickTranslation } from '@/utils/transformers/recipeTransformer';
import {
  Cookbook,
  CookbookWithRecipes,
  CookbookApiResponse,
  CookbookWithRecipesApiResponse,
  CreateCookbookInput,
  UpdateCookbookInput,
  AddRecipeToCookbookInput,
  UpdateCookbookRecipeInput,
  CookbookRecipe,
} from '@/types/cookbook.types';

// ============================================================================
// Embedded select fragments
// ============================================================================

const COOKBOOK_WITH_TRANSLATIONS = `
  *,
  translations:cookbook_translations(locale, name, description)
`;

const COOKBOOK_WITH_RECIPES_SELECT = `
  *,
  translations:cookbook_translations(locale, name, description),
  cookbook_recipes(
    *,
    translations:cookbook_recipe_translations(locale, notes),
    recipes(
      id,
      image_url,
      prep_time_minutes,
      cook_time_minutes,
      servings,
      difficulty,
      translations:recipe_translations(locale, name)
    )
  )
`;

// ============================================================================
// RPC Response Types (for SECURITY DEFINER functions)
// ============================================================================

/**
 * Response shape from get_cookbook_by_share_token() RPC function
 * Returns only non-translatable fields (translations fetched separately)
 */
interface SharedCookbookRpcResponse {
  id: string;
  user_id: string;
  is_public: boolean;
  is_default: boolean;
  share_token: string;
  share_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Response shape from get_cookbook_recipes_by_share_token() RPC function
 * Returns only non-translatable fields (translations fetched separately)
 */
interface SharedCookbookRecipeRpcResponse {
  cookbook_recipe_id: string;
  cookbook_id: string;
  recipe_id: string;
  display_order: number;
  added_at: string;
  recipe_image_url: string | null;
  recipe_prep_time_minutes: number | null;
  recipe_cook_time_minutes: number | null;
  recipe_servings: number | null;
  recipe_difficulty: string | null;
}

/**
 * Response shape for cookbook with filtered recipe IDs and total count aggregate.
 * Used by getCookbooksContainingRecipe where cookbook_recipes is filtered by !inner
 * and total_recipes provides the unfiltered count.
 */
interface CookbookWithRecipeFilterResponse extends CookbookApiResponse {
  cookbook_recipes: { recipe_id: string; id: string }[];
  total_recipes: { count: number }[];
}

// ============================================================================
// Transformation Functions
// ============================================================================

/**
 * Transform API response to frontend Cookbook type
 */
function transformCookbook(raw: CookbookApiResponse, recipeCount = 0): Cookbook {
  const t = pickTranslation(raw.translations);
  const name = t?.name ?? '';
  const description = t?.description ?? undefined;

  return {
    id: raw.id,
    userId: raw.user_id,
    name,
    description,
    isPublic: raw.is_public,
    isDefault: raw.is_default,
    shareEnabled: raw.share_enabled,
    shareToken: raw.share_token,
    recipeCount,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

/**
 * Transform cookbook with recipes
 */
function transformCookbookWithRecipes(
  raw: CookbookWithRecipesApiResponse
): CookbookWithRecipes {
  const recipes: CookbookRecipe[] = (raw.cookbook_recipes || [])
    .filter((cr) => cr.recipes != null)
    .map((cr) => {
      const recipeT = pickTranslation(cr.recipes.translations);
      const notesT = pickTranslation(cr.translations);

      return {
        id: cr.recipes.id,
        name: recipeT?.name ?? '',
        imageUrl: cr.recipes.image_url || undefined,
        prepTimeMinutes: cr.recipes.prep_time_minutes || undefined,
        cookTimeMinutes: cr.recipes.cook_time_minutes || undefined,
        servings: cr.recipes.servings || undefined,
        difficulty: cr.recipes.difficulty || undefined,
        notes: notesT?.notes ?? undefined,
        displayOrder: cr.display_order,
        addedAt: cr.added_at,
        cookbookRecipeId: cr.id,
      };
    });

  // Sort by display order
  recipes.sort((a, b) => a.displayOrder - b.displayOrder);

  return {
    ...transformCookbook(raw, recipes.length),
    recipes,
  };
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get all cookbooks for a user
 */
async function getUserCookbooks(userId: string): Promise<Cookbook[]> {
  const { data, error } = await supabase
    .from('cookbooks')
    .select(
      `
      *,
      translations:cookbook_translations(locale, name, description),
      cookbook_recipes(count)
    `
    )
    .eq('user_id', userId)
    .order('is_default', { ascending: false }) // Favorites first
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((raw) => {
    // cookbook_recipes(count) returns [{ count: number }] when using count aggregate
    const recipeCountResult = raw.cookbook_recipes as unknown as
      | [{ count: number }]
      | null;
    const recipeCount = recipeCountResult?.[0]?.count ?? 0;
    return transformCookbook(raw, recipeCount);
  });
}

/**
 * Get a single cookbook by ID with all recipes
 */
async function getCookbookById(cookbookId: string): Promise<CookbookWithRecipes> {
  const { data, error } = await supabase
    .from('cookbooks')
    .select(COOKBOOK_WITH_RECIPES_SELECT)
    .eq('id', cookbookId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Cookbook not found');
  }

  return transformCookbookWithRecipes(data);
}

/**
 * Get a cookbook by share token (for unauthenticated users)
 * Uses SECURITY DEFINER function to bypass RLS in a controlled manner
 *
 * Note: RPC functions still return flat rows with name_en/name_es columns.
 * These are transformed into the translations array shape expected by
 * transformCookbookWithRecipes. When the RPC functions are updated to
 * return translation joins, this mapping can be simplified.
 */
async function getCookbookByShareToken(
  shareToken: string
): Promise<CookbookWithRecipes> {
  // Input validation - fail fast for invalid tokens
  const trimmedToken = shareToken?.trim();
  if (!trimmedToken || trimmedToken.length === 0) {
    throw new Error('Share token is required');
  }

  // Call the SECURITY DEFINER function to get cookbook data
  const { data: cookbookData, error: cookbookError } = await supabase.rpc(
    'get_cookbook_by_share_token',
    { p_share_token: trimmedToken }
  );

  if (cookbookError) {
    throw new Error(cookbookError.message);
  }

  const typedCookbookData = cookbookData as SharedCookbookRpcResponse[] | null;

  if (!typedCookbookData || typedCookbookData.length === 0) {
    throw new Error('Cookbook not found');
  }

  const cookbook = typedCookbookData[0];

  // Fetch translations for this cookbook (RPC doesn't return them)
  const { data: cookbookTranslations } = await supabase
    .from('cookbook_translations')
    .select('locale, name, description')
    .eq('cookbook_id', cookbook.id);

  // Call the SECURITY DEFINER function to get cookbook recipes
  const { data: recipesData, error: recipesError } = await supabase.rpc(
    'get_cookbook_recipes_by_share_token',
    { p_share_token: trimmedToken }
  );

  if (recipesError) {
    throw new Error(recipesError.message);
  }

  const typedRecipesData = recipesData as SharedCookbookRecipeRpcResponse[] | null;

  // Collect recipe IDs to batch-fetch translations
  const recipeIds = (typedRecipesData || []).map((item) => item.recipe_id);
  const cookbookRecipeIds = (typedRecipesData || []).map((item) => item.cookbook_recipe_id);

  // Fetch recipe translations and note translations in parallel
  const [recipeTransResult, noteTransResult] = await Promise.all([
    recipeIds.length > 0
      ? supabase
          .from('recipe_translations')
          .select('recipe_id, locale, name')
          .in('recipe_id', recipeIds)
      : Promise.resolve({ data: [] }),
    cookbookRecipeIds.length > 0
      ? supabase
          .from('cookbook_recipe_translations')
          .select('cookbook_recipe_id, locale, notes')
          .in('cookbook_recipe_id', cookbookRecipeIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Index translations by entity ID for efficient lookup
  const recipeTransByRecipeId = new Map<string, { locale: string; name: string }[]>();
  for (const row of recipeTransResult.data || []) {
    const existing = recipeTransByRecipeId.get(row.recipe_id) || [];
    existing.push({ locale: row.locale, name: row.name });
    recipeTransByRecipeId.set(row.recipe_id, existing);
  }

  const noteTransByCrId = new Map<string, { locale: string; notes: string }[]>();
  for (const row of noteTransResult.data || []) {
    const existing = noteTransByCrId.get(row.cookbook_recipe_id) || [];
    existing.push({ locale: row.locale, notes: row.notes });
    noteTransByCrId.set(row.cookbook_recipe_id, existing);
  }

  // Reconstruct the full data structure with translations
  const transformedRecipes = (typedRecipesData || []).map((item) => ({
    id: item.cookbook_recipe_id,
    cookbook_id: item.cookbook_id,
    recipe_id: item.recipe_id,
    translations: noteTransByCrId.get(item.cookbook_recipe_id) || [],
    display_order: item.display_order,
    added_at: item.added_at,
    recipes: {
      id: item.recipe_id,
      image_url: item.recipe_image_url,
      prep_time_minutes: item.recipe_prep_time_minutes,
      cook_time_minutes: item.recipe_cook_time_minutes,
      servings: item.recipe_servings,
      difficulty: item.recipe_difficulty,
      translations: recipeTransByRecipeId.get(item.recipe_id) || [],
    },
  }));

  const reconstructedData = {
    ...cookbook,
    translations: cookbookTranslations || [],
    cookbook_recipes: transformedRecipes,
  };

  return transformCookbookWithRecipes(reconstructedData as CookbookWithRecipesApiResponse);
}

/**
 * Create a new cookbook
 */
async function createCookbook(
  userId: string,
  input: CreateCookbookInput
): Promise<Cookbook> {
  const locale = i18n.locale;

  // 1. Insert the cookbook entity (non-translatable fields only)
  const { data, error } = await supabase
    .from('cookbooks')
    .insert({
      user_id: userId,
      is_public: input.isPublic || false,
      is_default: input.isDefault || false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // 2. Upsert translation row for the user's current locale
  const { error: translationError } = await supabase
    .from('cookbook_translations')
    .upsert(
      {
        cookbook_id: data.id,
        locale,
        name: input.name,
        description: input.description || null,
      },
      { onConflict: 'cookbook_id,locale' }
    );

  if (translationError) {
    throw new Error(translationError.message);
  }

  // Return transformed cookbook with the translation we just wrote
  return {
    id: data.id,
    userId: data.user_id,
    name: input.name,
    description: input.description,
    isPublic: data.is_public,
    isDefault: data.is_default,
    shareEnabled: data.share_enabled,
    shareToken: data.share_token,
    recipeCount: 0,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Update an existing cookbook
 */
async function updateCookbook(
  cookbookId: string,
  input: UpdateCookbookInput
): Promise<void> {
  const locale = i18n.locale;

  // 1. Update non-translatable fields on the cookbooks table
  const entityUpdate: Partial<{
    is_public: boolean;
    share_enabled: boolean;
  }> = {};

  if (input.isPublic !== undefined) entityUpdate.is_public = input.isPublic;
  if (input.shareEnabled !== undefined) entityUpdate.share_enabled = input.shareEnabled;

  if (Object.keys(entityUpdate).length > 0) {
    const { error } = await supabase
      .from('cookbooks')
      .update(entityUpdate)
      .eq('id', cookbookId);

    if (error) {
      throw new Error(error.message);
    }
  }

  // 2. Upsert translation fields if provided
  const hasTranslationChanges = input.name !== undefined || input.description !== undefined;
  if (hasTranslationChanges) {
    const translationData: Record<string, unknown> = {
      cookbook_id: cookbookId,
      locale,
    };
    if (input.name !== undefined) translationData.name = input.name;
    if (input.description !== undefined) translationData.description = input.description;

    const { error: translationError } = await supabase
      .from('cookbook_translations')
      .upsert(translationData, { onConflict: 'cookbook_id,locale' });

    if (translationError) {
      throw new Error(translationError.message);
    }
  }
}

/**
 * Delete a cookbook
 */
async function deleteCookbook(cookbookId: string): Promise<void> {
  const { error } = await supabase
    .from('cookbooks')
    .delete()
    .eq('id', cookbookId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Add a recipe to a cookbook
 */
async function addRecipeToCookbook(input: AddRecipeToCookbookInput): Promise<void> {
  const locale = i18n.locale;

  // Get next display_order atomically via DB function (avoids race conditions)
  let nextOrder = 0;
  if (input.displayOrder === undefined) {
    const { data: orderData } = await supabase.rpc('next_cookbook_recipe_order', {
      p_cookbook_id: input.cookbookId,
    });
    nextOrder = orderData ?? 0;
  }

  // 1. Insert the cookbook_recipes junction row
  const { data: inserted, error } = await supabase
    .from('cookbook_recipes')
    .insert({
      cookbook_id: input.cookbookId,
      recipe_id: input.recipeId,
      display_order: input.displayOrder ?? nextOrder,
    })
    .select('id')
    .single();

  if (error) {
    // Handle unique constraint violation (recipe already in cookbook)
    if (error.code === '23505') {
      throw new Error('RECIPE_ALREADY_ADDED');
    }
    throw new Error(error.message);
  }

  // 2. If notes provided, upsert translation row
  if (input.notes) {
    const { error: translationError } = await supabase
      .from('cookbook_recipe_translations')
      .upsert(
        {
          cookbook_recipe_id: inserted.id,
          locale,
          notes: input.notes,
        },
        { onConflict: 'cookbook_recipe_id,locale' }
      );

    if (translationError) {
      throw new Error(translationError.message);
    }
  }
}

/**
 * Remove a recipe from a cookbook
 */
async function removeRecipeFromCookbook(
  cookbookId: string,
  recipeId: string
): Promise<void> {
  const { error } = await supabase
    .from('cookbook_recipes')
    .delete()
    .eq('cookbook_id', cookbookId)
    .eq('recipe_id', recipeId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Update recipe notes or display order in a cookbook
 */
async function updateCookbookRecipe(
  cookbookRecipeId: string,
  input: UpdateCookbookRecipeInput
): Promise<void> {
  const locale = i18n.locale;

  // 1. Update non-translatable fields on junction table
  if (input.displayOrder !== undefined) {
    const { error } = await supabase
      .from('cookbook_recipes')
      .update({ display_order: input.displayOrder })
      .eq('id', cookbookRecipeId);

    if (error) {
      throw new Error(error.message);
    }
  }

  // 2. Upsert notes translation if provided
  if (input.notes !== undefined) {
    const { error: translationError } = await supabase
      .from('cookbook_recipe_translations')
      .upsert(
        {
          cookbook_recipe_id: cookbookRecipeId,
          locale,
          notes: input.notes,
        },
        { onConflict: 'cookbook_recipe_id,locale' }
      );

    if (translationError) {
      throw new Error(translationError.message);
    }
  }
}

/**
 * Get cookbook IDs that contain a specific recipe for a user
 */
async function getCookbookIdsContainingRecipe(
  userId: string,
  recipeId: string
): Promise<string[]> {
  // Input validation - fail fast for invalid parameters
  if (!userId || !recipeId) {
    return [];
  }

  const { data, error } = await supabase
    .from('cookbook_recipes')
    .select('cookbook_id, cookbooks!inner(user_id)')
    .eq('recipe_id', recipeId)
    .eq('cookbooks.user_id', userId);

  if (error) {
    return [];
  }

  return (data || []).map((row) => row.cookbook_id);
}

/**
 * Get cookbooks that contain a specific recipe for a user
 * More efficient than fetching all cookbooks and filtering
 * Returns cookbooks with their TOTAL recipe count (not just the filtered one)
 */
async function getCookbooksContainingRecipe(
  userId: string,
  recipeId: string
): Promise<Cookbook[]> {
  // Input validation - fail fast for invalid parameters
  if (!userId || !recipeId) {
    return [];
  }

  const { data, error } = await supabase
    .from('cookbooks')
    .select(
      `
      *,
      translations:cookbook_translations(locale, name, description),
      cookbook_recipes!inner(recipe_id, id),
      total_recipes:cookbook_recipes(count)
    `
    )
    .eq('user_id', userId)
    .eq('cookbook_recipes.recipe_id', recipeId);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((raw) => {
    const typedRaw = raw as unknown as CookbookWithRecipeFilterResponse;
    const recipeCount = typedRaw.total_recipes?.[0]?.count ?? 0;
    return transformCookbook(typedRaw, recipeCount);
  });
}

/**
 * Ensure default "Favorites" cookbook exists for user
 * Creates it if it doesn't exist
 */
async function ensureDefaultCookbook(userId: string): Promise<Cookbook> {
  // Check if default cookbook exists
  const { data: existing, error: checkError } = await supabase
    .from('cookbooks')
    .select(COOKBOOK_WITH_TRANSLATIONS)
    .eq('user_id', userId)
    .eq('is_default', true)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    // PGRST116 = not found, which is fine
    throw new Error(checkError.message);
  }

  if (existing) {
    return transformCookbook(existing, 0);
  }

  // Create default "Favorites" cookbook with both locale translations
  const { data, error } = await supabase
    .from('cookbooks')
    .insert({
      user_id: userId,
      is_public: false,
      is_default: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Insert translations for both locales for the default cookbook
  const { error: translationError } = await supabase
    .from('cookbook_translations')
    .upsert(
      [
        { cookbook_id: data.id, locale: 'en', name: 'Favorites', description: 'My favorite recipes' },
        { cookbook_id: data.id, locale: 'es', name: 'Favoritos', description: 'Mis recetas favoritas' },
      ],
      { onConflict: 'cookbook_id,locale' }
    );

  if (translationError) {
    throw new Error(translationError.message);
  }

  return {
    id: data.id,
    userId: data.user_id,
    name: i18n.locale === 'es' ? 'Favoritos' : 'Favorites',
    description: i18n.locale === 'es' ? 'Mis recetas favoritas' : 'My favorite recipes',
    isPublic: data.is_public,
    isDefault: data.is_default,
    shareEnabled: data.share_enabled,
    shareToken: data.share_token,
    recipeCount: 0,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Regenerate share token for a cookbook
 */
async function regenerateShareToken(cookbookId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_cookbook_share_token', {
    cookbook_id: cookbookId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// ============================================================================
// Exports
// ============================================================================

export const cookbookService = {
  getUserCookbooks,
  getCookbookById,
  getCookbookByShareToken,
  createCookbook,
  updateCookbook,
  deleteCookbook,
  addRecipeToCookbook,
  removeRecipeFromCookbook,
  updateCookbookRecipe,
  ensureDefaultCookbook,
  regenerateShareToken,
  getCookbookIdsContainingRecipe,
  getCookbooksContainingRecipe,
};
