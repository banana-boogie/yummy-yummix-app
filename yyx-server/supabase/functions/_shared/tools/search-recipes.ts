/**
 * Recipe Search Tool
 *
 * Searches the recipe database with semantic understanding, filters,
 * and allergen exclusion. Returns RecipeCard[] for display.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { RecipeCard, SearchRecipesParams } from '../irmixy-schemas.ts';
import { normalizeIngredients } from '../ingredient-normalization.ts';
import { filterByAllergens } from '../allergen-filter.ts';

interface RecipeSearchResult {
  id: string;
  name_en: string;
  name_es: string;
  image_url: string | null;
  total_time: number;
  difficulty: 'easy' | 'medium' | 'hard';
  portions: number;
  tags: { name_en: string; name_es: string; categories: string[] }[];
}

/**
 * Search recipes with filters and allergen exclusion
 */
export async function searchRecipes(
  supabase: SupabaseClient,
  params: SearchRecipesParams,
  userContext: {
    language: 'en' | 'es';
    dietaryRestrictions: string[];
  },
): Promise<RecipeCard[]> {
  // Build base query
  let query = supabase
    .from('recipes')
    .select(
      `
      id,
      name_en,
      name_es,
      image_url,
      total_time,
      difficulty,
      portions,
      recipe_tags (
        recipe_tag:tags (
          name_en,
          name_es,
          categories
        )
      )
    `,
    )
    .eq('published', true)
    .order('created_at', { ascending: false });

  // Apply difficulty filter
  if (params.difficulty) {
    query = query.eq('difficulty', params.difficulty);
  }

  // Apply time filter
  if (params.maxTime) {
    query = query.lte('total_time', params.maxTime);
  }

  // Apply cuisine filter (via tags)
  if (params.cuisine) {
    // This requires a more complex query using recipe_tags
    // For now, we'll fetch all and filter in-memory
  }

  // Execute query with limit
  const { data, error } = await query.limit(params.limit || 10);

  if (error) {
    console.error('Recipe search error:', error);
    throw new Error('Failed to search recipes');
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Transform to RecipeCard format
  const recipes: RecipeCard[] = data.map((recipe: RecipeSearchResult) => ({
    recipeId: recipe.id,
    name: userContext.language === 'es' ? recipe.name_es : recipe.name_en,
    imageUrl: recipe.image_url || undefined,
    totalTime: recipe.total_time,
    difficulty: recipe.difficulty,
    portions: recipe.portions,
  }));

  // Filter by cuisine if specified
  let filtered = recipes;
  if (params.cuisine) {
    filtered = filterByCuisine(data, params.cuisine, userContext.language);
  }

  // Filter by user's dietary restrictions (allergen-based)
  if (userContext.dietaryRestrictions.length > 0) {
    // Fetch full recipe data including ingredients for allergen filtering
    const recipeIds = filtered.map((r) => r.recipeId);
    const recipesWithIngredients = await fetchRecipesWithIngredients(
      supabase,
      recipeIds,
    );

    const safeRecipes = await filterByAllergens(
      supabase,
      recipesWithIngredients,
      userContext.dietaryRestrictions,
    );

    const safeIds = new Set(safeRecipes.map((r) => r.id));
    filtered = filtered.filter((r) => safeIds.has(r.recipeId));
  }

  // Apply query-based relevance scoring if there's a search query
  if (params.query) {
    filtered = scoreByQuery(data, filtered, params.query, userContext.language);
  }

  return filtered;
}

/**
 * Filter recipes by cuisine using tags
 */
function filterByCuisine(
  data: RecipeSearchResult[],
  cuisine: string,
  language: 'en' | 'es',
): RecipeCard[] {
  const cuisineLower = cuisine.toLowerCase();

  return data
    .filter((recipe) => {
      if (!recipe.tags || recipe.tags.length === 0) return false;

      return recipe.tags.some((tagWrapper) => {
        const tag = tagWrapper.recipe_tag;
        if (!tag) return false;

        // Check if this is a CULTURAL_CUISINE tag
        if (!tag.categories.includes('CULTURAL_CUISINE')) return false;

        // Check if the cuisine matches
        const tagName = language === 'es' ? tag.name_es : tag.name_en;
        return tagName.toLowerCase().includes(cuisineLower);
      });
    })
    .map((recipe) => ({
      recipeId: recipe.id,
      name: language === 'es' ? recipe.name_es : recipe.name_en,
      imageUrl: recipe.image_url || undefined,
      totalTime: recipe.total_time,
      difficulty: recipe.difficulty,
      portions: recipe.portions,
    }));
}

/**
 * Score recipes by relevance to search query
 * (Simple keyword matching for Phase 1; semantic search in Phase 3)
 */
function scoreByQuery(
  data: RecipeSearchResult[],
  filtered: RecipeCard[],
  query: string,
  language: 'en' | 'es',
): RecipeCard[] {
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/);

  const scored = filtered.map((recipe) => {
    // Find original recipe data
    const original = data.find((r) => r.id === recipe.recipeId);
    if (!original) return { recipe, score: 0 };

    let score = 0;

    // Check recipe name
    const name = language === 'es' ? original.name_es : original.name_en;
    const nameLower = name.toLowerCase();

    // Exact name match gets high score
    if (nameLower === queryLower) {
      score += 100;
    } else if (nameLower.includes(queryLower)) {
      score += 50;
    }

    // Keyword matches
    keywords.forEach((keyword) => {
      if (nameLower.includes(keyword)) score += 10;
    });

    // Tag matches
    if (original.tags) {
      original.tags.forEach((tagWrapper) => {
        const tag = tagWrapper.recipe_tag;
        if (!tag) return;

        const tagName = (language === 'es' ? tag.name_es : tag.name_en)
          .toLowerCase();

        if (tagName.includes(queryLower)) score += 20;
        keywords.forEach((keyword) => {
          if (tagName.includes(keyword)) score += 5;
        });
      });
    }

    return { recipe, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.recipe);
}

/**
 * Fetch recipes with full ingredient data for allergen filtering
 */
async function fetchRecipesWithIngredients(
  supabase: SupabaseClient,
  recipeIds: string[],
): Promise<Array<{ id: string; ingredients: Array<{ name: string }> }>> {
  const { data, error } = await supabase
    .from('recipes')
    .select(
      `
      id,
      recipe_ingredients (
        ingredient:ingredients (
          name_en,
          name_es
        )
      )
    `,
    )
    .in('id', recipeIds);

  if (error || !data) {
    return [];
  }

  return data.map((recipe: any) => ({
    id: recipe.id,
    ingredients:
      recipe.recipe_ingredients?.map((ri: any) => ({
        name: ri.ingredient?.name_en || '',
      })) || [],
  }));
}

/**
 * Build tool definition for LLM
 */
export const searchRecipesTool = {
  name: 'search_recipes',
  description:
    'Search the recipe database for existing recipes based on user criteria. ' +
    'Use this when the user wants to find recipes from the database (not create custom ones). ' +
    'Returns recipe cards that match the filters. Results are automatically filtered by ' +
    "the user's dietary restrictions and allergens.",
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Natural language search query (e.g., "pasta", "healthy dinner", "chicken stir fry")',
      },
      cuisine: {
        type: 'string',
        description:
          'Cuisine type filter (e.g., "Italian", "Asian", "Mexican", "Mediterranean")',
      },
      maxTime: {
        type: 'integer',
        description: 'Maximum total cooking time in minutes',
        minimum: 1,
        maximum: 480,
      },
      difficulty: {
        type: 'string',
        enum: ['easy', 'medium', 'hard'],
        description: 'Recipe difficulty level',
      },
      limit: {
        type: 'integer',
        description: 'Maximum number of results to return (default: 10)',
        minimum: 1,
        maximum: 20,
        default: 10,
      },
    },
    required: ['query'],
  },
};
