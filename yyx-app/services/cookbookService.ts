import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';
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

// Helper function to get current language suffix
const getLangSuffix = () => `_${i18n.locale}`;

// ============================================================================
// Transformation Functions
// ============================================================================

/**
 * Transform API response to frontend Cookbook type
 */
function transformCookbook(raw: CookbookApiResponse, recipeCount = 0): Cookbook {
  const lang = i18n.locale;
  return {
    id: raw.id,
    userId: raw.user_id,
    name: lang === 'es' && raw.name_es ? raw.name_es : raw.name_en,
    description:
      lang === 'es' && raw.description_es
        ? raw.description_es
        : raw.description_en || undefined,
    isPublic: raw.is_public,
    isDefault: raw.is_default,
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
  const lang = i18n.locale;
  const recipes: CookbookRecipe[] = (raw.cookbook_recipes || []).map((cr) => ({
    id: cr.recipes.id,
    name:
      lang === 'es' && cr.recipes.name_es
        ? cr.recipes.name_es
        : cr.recipes.name_en,
    description:
      lang === 'es' && cr.recipes.description_es
        ? cr.recipes.description_es
        : cr.recipes.description_en || undefined,
    imageUrl: cr.recipes.image_url || undefined,
    prepTimeMinutes: cr.recipes.prep_time_minutes || undefined,
    cookTimeMinutes: cr.recipes.cook_time_minutes || undefined,
    servings: cr.recipes.servings || undefined,
    difficulty: cr.recipes.difficulty || undefined,
    notes: lang === 'es' && cr.notes_es ? cr.notes_es : cr.notes_en || undefined,
    displayOrder: cr.display_order,
    addedAt: cr.added_at,
    cookbookRecipeId: cr.id,
  }));

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
      cookbook_recipes(count)
    `
    )
    .eq('user_id', userId)
    .order('is_default', { ascending: false }) // Favorites first
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching cookbooks:', error);
    throw new Error(error.message);
  }

  return (data || []).map((raw) => {
    // Count recipes
    const recipeCount = Array.isArray(raw.cookbook_recipes)
      ? raw.cookbook_recipes.length
      : 0;
    return transformCookbook(raw, recipeCount);
  });
}

/**
 * Get a single cookbook by ID with all recipes
 */
async function getCookbookById(cookbookId: string): Promise<CookbookWithRecipes> {
  const { data, error } = await supabase
    .from('cookbooks')
    .select(
      `
      *,
      cookbook_recipes(
        *,
        recipes(
          id,
          name_en,
          name_es,
          description_en,
          description_es,
          image_url,
          prep_time_minutes,
          cook_time_minutes,
          servings,
          difficulty
        )
      )
    `
    )
    .eq('id', cookbookId)
    .single();

  if (error) {
    console.error('Error fetching cookbook:', error);
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Cookbook not found');
  }

  return transformCookbookWithRecipes(data);
}

/**
 * Get a cookbook by share token (for unauthenticated users)
 */
async function getCookbookByShareToken(
  shareToken: string
): Promise<CookbookWithRecipes> {
  const { data, error } = await supabase
    .from('cookbooks')
    .select(
      `
      *,
      cookbook_recipes(
        *,
        recipes(
          id,
          name_en,
          name_es,
          description_en,
          description_es,
          image_url,
          prep_time_minutes,
          cook_time_minutes,
          servings,
          difficulty
        )
      )
    `
    )
    .eq('share_token', shareToken)
    .single();

  if (error) {
    console.error('Error fetching shared cookbook:', error);
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Cookbook not found');
  }

  // Check if cookbook is accessible (public or has valid token)
  if (!data.is_public && !shareToken) {
    throw new Error('This cookbook is private');
  }

  return transformCookbookWithRecipes(data);
}

/**
 * Create a new cookbook
 */
async function createCookbook(
  userId: string,
  input: CreateCookbookInput
): Promise<Cookbook> {
  const { data, error } = await supabase
    .from('cookbooks')
    .insert({
      user_id: userId,
      name_en: input.nameEn,
      name_es: input.nameEs || null,
      description_en: input.descriptionEn || null,
      description_es: input.descriptionEs || null,
      is_public: input.isPublic || false,
      is_default: input.isDefault || false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating cookbook:', error);
    throw new Error(error.message);
  }

  return transformCookbook(data, 0);
}

/**
 * Update an existing cookbook
 */
async function updateCookbook(
  cookbookId: string,
  input: UpdateCookbookInput
): Promise<void> {
  const updateData: Partial<{
    name_en: string;
    name_es: string | null;
    description_en: string | null;
    description_es: string | null;
    is_public: boolean;
  }> = {};

  if (input.nameEn !== undefined) updateData.name_en = input.nameEn;
  if (input.nameEs !== undefined) updateData.name_es = input.nameEs;
  if (input.descriptionEn !== undefined)
    updateData.description_en = input.descriptionEn;
  if (input.descriptionEs !== undefined)
    updateData.description_es = input.descriptionEs;
  if (input.isPublic !== undefined) updateData.is_public = input.isPublic;

  const { error } = await supabase
    .from('cookbooks')
    .update(updateData)
    .eq('id', cookbookId);

  if (error) {
    console.error('Error updating cookbook:', error);
    throw new Error(error.message);
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
    console.error('Error deleting cookbook:', error);
    throw new Error(error.message);
  }
}

/**
 * Add a recipe to a cookbook
 */
async function addRecipeToCookbook(input: AddRecipeToCookbookInput): Promise<void> {
  // Get current max display order
  const { data: existing } = await supabase
    .from('cookbook_recipes')
    .select('display_order')
    .eq('cookbook_id', input.cookbookId)
    .order('display_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0;

  const { error } = await supabase.from('cookbook_recipes').insert({
    cookbook_id: input.cookbookId,
    recipe_id: input.recipeId,
    notes_en: input.notesEn || null,
    notes_es: input.notesEs || null,
    display_order: input.displayOrder ?? nextOrder,
  });

  if (error) {
    console.error('Error adding recipe to cookbook:', error);
    throw new Error(error.message);
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
    console.error('Error removing recipe from cookbook:', error);
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
  const updateData: Partial<{
    notes_en: string | null;
    notes_es: string | null;
    display_order: number;
  }> = {};

  if (input.notesEn !== undefined) updateData.notes_en = input.notesEn;
  if (input.notesEs !== undefined) updateData.notes_es = input.notesEs;
  if (input.displayOrder !== undefined)
    updateData.display_order = input.displayOrder;

  const { error } = await supabase
    .from('cookbook_recipes')
    .update(updateData)
    .eq('id', cookbookRecipeId);

  if (error) {
    console.error('Error updating cookbook recipe:', error);
    throw new Error(error.message);
  }
}

/**
 * Ensure default "Favorites" cookbook exists for user
 * Creates it if it doesn't exist
 */
async function ensureDefaultCookbook(userId: string): Promise<Cookbook> {
  // Check if default cookbook exists
  const { data: existing, error: checkError } = await supabase
    .from('cookbooks')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    // PGRST116 = not found, which is fine
    console.error('Error checking for default cookbook:', checkError);
    throw new Error(checkError.message);
  }

  if (existing) {
    return transformCookbook(existing, 0);
  }

  // Create default "Favorites" cookbook
  return createCookbook(userId, {
    nameEn: 'Favorites',
    nameEs: 'Favoritos',
    descriptionEn: 'My favorite recipes',
    descriptionEs: 'Mis recetas favoritas',
    isPublic: false,
    isDefault: true,
  });
}

/**
 * Regenerate share token for a cookbook
 */
async function regenerateShareToken(cookbookId: string): Promise<string> {
  // Supabase will generate a new UUID via gen_random_uuid()
  const { data, error } = await supabase.rpc('regenerate_cookbook_share_token', {
    cookbook_id: cookbookId,
  });

  if (error) {
    // Fallback: generate token on client side if RPC doesn't exist
    const newToken = crypto.randomUUID();
    const { error: updateError } = await supabase
      .from('cookbooks')
      .update({ share_token: newToken })
      .eq('id', cookbookId);

    if (updateError) {
      console.error('Error regenerating share token:', updateError);
      throw new Error(updateError.message);
    }

    return newToken;
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
};
