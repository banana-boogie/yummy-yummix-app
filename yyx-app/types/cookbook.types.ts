// ============================================================================
// Cookbook Types - Frontend Representation
// ============================================================================

/**
 * Transformed cookbook type for frontend use
 * Language-specific fields are resolved based on user's locale
 */
export interface Cookbook {
  id: string;
  userId: string;
  name: string; // Single-language user content
  description?: string; // Single-language user content
  isPublic: boolean;
  isDefault: boolean; // True for auto-created "Favorites" cookbook
  shareEnabled: boolean;
  shareToken: string;
  recipeCount: number; // Computed from cookbook_recipes junction
  coverImageUrl?: string; // First recipe's image URL, for card display
  createdAt: string;
  updatedAt: string;
}

/**
 * Cookbook with full recipe details
 */
export interface CookbookWithRecipes extends Cookbook {
  recipes: CookbookRecipe[];
}

/**
 * Recipe within a cookbook (includes junction table data)
 */
export interface CookbookRecipe {
  id: string; // Recipe ID
  name: string;
  description?: string;
  imageUrl?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  difficulty?: string;
  // Junction table fields
  notes?: string; // Personal notes from cookbook_recipes
  displayOrder: number;
  addedAt: string;
  cookbookRecipeId: string; // ID from cookbook_recipes junction
}

// ============================================================================
// API Types - Database Schema (translation table pattern)
// ============================================================================

/**
 * Translation row for cookbook_translations table
 */
export interface CookbookTranslation {
  locale: string;
  name: string;
  description?: string | null;
}

/**
 * Translation row for cookbook_recipe_translations table
 */
export interface CookbookRecipeTranslation {
  locale: string;
  notes?: string | null;
}

/**
 * Translation row for recipe_translations (as embedded in cookbook queries)
 */
export interface CookbookRecipeRecipeTranslation {
  locale: string;
  name: string;
}

/**
 * Raw cookbook from Supabase (before transformation)
 */
export interface CookbookApiResponse {
  id: string;
  user_id: string;
  is_public: boolean;
  is_default: boolean;
  share_token: string;
  share_enabled: boolean;
  created_at: string;
  updated_at: string;
  translations?: CookbookTranslation[];
}

/**
 * Raw cookbook_recipes junction table row
 */
export interface CookbookRecipeApiResponse {
  id: string;
  cookbook_id: string;
  recipe_id: string;
  display_order: number;
  added_at: string;
  translations?: CookbookRecipeTranslation[];
}

/**
 * Recipe data as nested in cookbook queries
 */
export interface CookbookRecipeRecipeApiResponse {
  id: string;
  image_url: string | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
  difficulty: string | null;
  translations?: CookbookRecipeRecipeTranslation[];
}

/**
 * Combined response with recipe details
 */
export interface CookbookWithRecipesApiResponse extends CookbookApiResponse {
  cookbook_recipes: (CookbookRecipeApiResponse & {
      recipes: CookbookRecipeRecipeApiResponse;
    })[];
}

// ============================================================================
// Input Types - For Create/Update Operations
// ============================================================================

/**
 * Input for creating a new cookbook
 */
export interface CreateCookbookInput {
  name: string;
  description?: string;
  isPublic?: boolean;
  isDefault?: boolean;
}

/**
 * Input for updating an existing cookbook
 */
export interface UpdateCookbookInput {
  name?: string;
  description?: string;
  isPublic?: boolean;
  shareEnabled?: boolean;
}

/**
 * Input for adding a recipe to a cookbook
 */
export interface AddRecipeToCookbookInput {
  cookbookId: string;
  recipeId: string;
  notes?: string;
  displayOrder?: number;
}

/**
 * Input for updating recipe notes/order in cookbook
 */
export interface UpdateCookbookRecipeInput {
  notes?: string;
  displayOrder?: number;
}
