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
// API Types - Database Schema
// ============================================================================

/**
 * Raw cookbook from Supabase (before transformation)
 */
export interface CookbookApiResponse {
  id: string;
  user_id: string;
  name_en: string;
  name_es: string | null;
  description_en: string | null;
  description_es: string | null;
  is_public: boolean;
  is_default: boolean;
  share_token: string;
  share_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Raw cookbook_recipes junction table row
 */
export interface CookbookRecipeApiResponse {
  id: string;
  cookbook_id: string;
  recipe_id: string;
  notes_en: string | null;
  notes_es: string | null;
  display_order: number;
  added_at: string;
}

/**
 * Combined response with recipe details
 */
export interface CookbookWithRecipesApiResponse extends CookbookApiResponse {
  cookbook_recipes: Array<
    CookbookRecipeApiResponse & {
      recipes: {
        id: string;
        name_en: string;
        name_es: string | null;
        description_en: string | null;
        description_es: string | null;
        image_url: string | null;
        prep_time_minutes: number | null;
        cook_time_minutes: number | null;
        servings: number | null;
        difficulty: string | null;
      };
    }
  >;
}

// ============================================================================
// Input Types - For Create/Update Operations
// ============================================================================

/**
 * Input for creating a new cookbook
 */
export interface CreateCookbookInput {
  nameEn: string;
  nameEs?: string;
  descriptionEn?: string;
  descriptionEs?: string;
  isPublic?: boolean;
  isDefault?: boolean;
}

/**
 * Input for updating an existing cookbook
 */
export interface UpdateCookbookInput {
  nameEn?: string;
  nameEs?: string;
  descriptionEn?: string;
  descriptionEs?: string;
  isPublic?: boolean;
  shareEnabled?: boolean;
}

/**
 * Input for adding a recipe to a cookbook
 */
export interface AddRecipeToCookbookInput {
  cookbookId: string;
  recipeId: string;
  notesEn?: string;
  notesEs?: string;
  displayOrder?: number;
}

/**
 * Input for updating recipe notes/order in cookbook
 */
export interface UpdateCookbookRecipeInput {
  notesEn?: string;
  notesEs?: string;
  displayOrder?: number;
}
