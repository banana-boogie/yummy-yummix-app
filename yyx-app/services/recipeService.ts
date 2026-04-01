import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';
import logger from '@/services/logger';
import { RawRecipe } from '@/types/recipe.api.types';
import { PostgrestSingleResponse } from '@supabase/supabase-js';
import { recipeCache } from '@/services/cache/recipeCache';
import { isValidUUID } from '@/utils/validation';

// Helper to generate language-aware cache key
const getLanguageAwareKey = (baseKey: string) => `${baseKey}_${i18n.locale}`;

const getRecipeListQuery = () => {
  return `
    id,
    image_url,
    difficulty,
    prep_time,
    total_time,
    portions,
    is_published,
    created_at,
    updated_at,
    translations:recipe_translations (
      locale,
      name,
      tips_and_tricks
    ),
    average_rating,
    rating_count,
    ingredients:recipe_ingredients (
      quantity,
      ingredient:ingredients (
        id,
        translations:ingredient_translations (
          locale,
          name,
          plural_name
        )
      )
    ),
    tags:recipe_to_tag (
      recipe_tags (
        id,
        translations:recipe_tag_translations (
          locale,
          name
        )
      )
    )
  `;
};

const getRecipeDetailQuery = () => {
  return `
    id,
    image_url,
    difficulty,
    prep_time,
    total_time,
    portions,
    is_published,
    translations:recipe_translations (
      locale,
      name,
      tips_and_tricks
    ),
    average_rating,
    rating_count,
    steps:recipe_steps!inner (
      id,
      order,
      translations:recipe_step_translations (
        locale,
        instruction,
        recipe_section,
        tip
      ),
      thermomix_time,
      thermomix_speed,
      thermomix_speed_start,
      thermomix_speed_end,
      thermomix_temperature,
      thermomix_is_blade_reversed,
      thermomix_mode,
      timer_seconds,
      step_ingredients:recipe_step_ingredients (
        id,
        quantity,
        optional,
        display_order,
        ingredient:ingredients!inner (
          id,
          image_url,
          translations:ingredient_translations (
            locale,
            name,
            plural_name
          )
        ),
        measurement_unit:measurement_units!inner (
          id,
          type,
          system,
          translations:measurement_unit_translations (
            locale,
            name,
            name_plural,
            symbol,
            symbol_plural
          )
        )
      )
    ),
    ingredients:recipe_ingredients (
      quantity,
      display_order,
      optional,
      translations:recipe_ingredient_translations (
        locale,
        notes,
        recipe_section
      ),
      ingredient:ingredients (
        id,
        image_url,
        translations:ingredient_translations (
          locale,
          name,
          plural_name
        )
      ),
      measurement_unit:measurement_units !inner(
        id,
        type,
        system,
        translations:measurement_unit_translations (
          locale,
          name,
          name_plural,
          symbol,
          symbol_plural
        )
      )
    ),
    tags:recipe_to_tag (
      recipe_tags!inner (
        id,
        translations:recipe_tag_translations (
          locale,
          name
        )
      )
    ),
    kitchen_tools:recipe_kitchen_tools (
      id,
      display_order,
      translations:recipe_kitchen_tool_translations (
        locale,
        notes
      ),
      kitchen_tool:kitchen_tools (
        id,
        image_url,
        translations:kitchen_tool_translations (
          locale,
          name
        )
      )
    )
  `;
};

type IdRow = { id: string };
type RecipeIdRow = { recipe_id: string };

const normalizeSearchTerm = (searchTerm: string) => searchTerm.trim().toLowerCase();

/**
 * Resolve recipe IDs for search across recipe names, ingredients, and tags.
 * Uses translation tables for locale-aware searching.
 */
const findRecipeIdsForSearch = async (
  rawSearchTerm: string,
  isPublished: boolean | undefined,
): Promise<string[]> => {
  const searchTerm = normalizeSearchTerm(rawSearchTerm);
  if (!searchTerm) return [];

  const pattern = `%${searchTerm}%`;
  const recipeIds = new Set<string>();

  // 1) Direct recipe name matches via translation table
  const { data: nameMatches, error: nameError } = await supabase
    .from('recipe_translations')
    .select('recipe_id')
    .ilike('name', pattern)
    .limit(200);

  if (nameError) logger.warn('[recipeService] Name search error:', nameError.message);

  // If isPublished filter is needed, we need to cross-reference
  if (isPublished !== undefined && nameMatches?.length) {
    const candidateIds = (nameMatches ?? []).map(r => r.recipe_id);
    const { data: publishedRecipes } = await supabase
      .from('recipes')
      .select('id')
      .in('id', candidateIds)
      .eq('is_published', isPublished);
    for (const row of publishedRecipes ?? []) {
      recipeIds.add(row.id);
    }
  } else {
    for (const row of nameMatches ?? []) {
      recipeIds.add(row.recipe_id);
    }
  }

  // 2) Ingredient name matches via translation table -> recipe IDs
  const { data: ingredientMatches, error: ingredientError } = await supabase
    .from('ingredient_translations')
    .select('ingredient_id')
    .ilike('name', pattern)
    .limit(200);
  if (ingredientError) logger.warn('[recipeService] Ingredient search error:', ingredientError.message);

  const ingredientIds = (ingredientMatches ?? []).map((row: any) => row.ingredient_id);
  if (ingredientIds.length > 0) {
    const { data: recipeIngredientRows, error: riError } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id')
      .in('ingredient_id', ingredientIds)
      .limit(500);
    if (riError) logger.warn('[recipeService] Recipe-ingredient join error:', riError.message);

    for (const row of recipeIngredientRows ?? []) {
      recipeIds.add(row.recipe_id);
    }
  }

  // 3) Tag matches via translation table -> recipe IDs
  const { data: tagMatches, error: tagError } = await supabase
    .from('recipe_tag_translations')
    .select('recipe_tag_id')
    .ilike('name', pattern)
    .limit(200);
  if (tagError) logger.warn('[recipeService] Tag search error:', tagError.message);

  const tagIds = (tagMatches ?? []).map((row: any) => row.recipe_tag_id);
  if (tagIds.length > 0) {
    const { data: recipeTagRows, error: rtError } = await supabase
      .from('recipe_to_tag')
      .select('recipe_id')
      .in('tag_id', tagIds)
      .limit(500);
    if (rtError) logger.warn('[recipeService] Recipe-tag join error:', rtError.message);

    for (const row of recipeTagRows ?? []) {
      recipeIds.add(row.recipe_id);
    }
  }

  return [...recipeIds];
};

// Track in-flight requests to prevent duplicates
const inFlightRequests: Record<string, Promise<any>> = {};

// Updated recipe service with cursor pagination and caching
export const recipeService = {
  async getRecipes({
    limit = 20,
    cursor = null,
    cursorField = 'updated_at',
    sortDirection = 'desc',
    searchTerm = null,
    filters = { isPublished: true }
  } = {}): Promise<{
    data: RawRecipe[],
    nextCursor: string | null,
    hasMore: boolean
  }> {
    // Create params object for caching and deduplication
    const params = {
      searchTerm,
      filters,
      cursor,
      cursorField,
      sortDirection,
      limit,
    };

    // Create language-aware cache key
    const cacheKey = getLanguageAwareKey(`recipe_query_${JSON.stringify(params)}`);

    // Try to get from cache first
    const cachedResult = await recipeCache.getQueryResult(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // Generate request key for deduplication - include language
    const requestKey = cacheKey;

    // Return existing request if one is in progress
    if (requestKey in inFlightRequests) {
      return inFlightRequests[requestKey];
    }

    // Create new request
    const requestPromise = (async () => {
      try {
        let query = supabase
          .from('recipes')
          .select(getRecipeListQuery());

        // Apply sorting
        query = query.order(cursorField, { ascending: sortDirection === 'asc' });

        // Apply filters
        if (filters.isPublished !== undefined) {
          query = query.eq('is_published', filters.isPublished);
        }

        // Apply search if provided (name + ingredients + tags)
        if (searchTerm) {
          const matchedRecipeIds = await findRecipeIdsForSearch(
            searchTerm,
            filters.isPublished,
          );

          if (matchedRecipeIds.length === 0) {
            return {
              data: [],
              nextCursor: null,
              hasMore: false,
            };
          }

          query = query.in('id', matchedRecipeIds);
        }

        // Apply cursor-based pagination
        if (cursor) {
          if (sortDirection === 'desc') {
            query = query.lt(cursorField, cursor);
          } else {
            query = query.gt(cursorField, cursor);
          }
        }

        // Apply limit
        query = query.limit(limit);

        const response = await query;

        if (response.error) {
          throw new Error("Error fetching recipes: " + response.error.message);
        }

        const recipes = (response.data ?? []) as unknown as RawRecipe[];

        // Get cursor for next page (last item's timestamp)
        const nextCursor = recipes.length > 0 ?
          recipes[recipes.length - 1][cursorField as keyof RawRecipe] as string | null :
          null;
        const hasMore = recipes.length === limit;

        const result = {
          data: recipes,
          nextCursor,
          hasMore
        };

        // Cache the result
        await recipeCache.setQueryResult(cacheKey, result);

        return result;
      } finally {
        // Clear request when completed
        delete inFlightRequests[requestKey];
      }
    })();

    // Store the promise
    inFlightRequests[requestKey] = requestPromise;
    return requestPromise;
  },

  async getRecipeById(id: string): Promise<RawRecipe | null> {
    // Validate UUID format first to prevent invalid database queries
    if (!id || !isValidUUID(id)) {
      throw new Error(`Invalid recipe ID format: ${id}`);
    }

    // Create a language-specific cache key
    const cacheKey = getLanguageAwareKey(`recipe_${id}`);

    // Try to get from cache first
    const cachedRecipe = await recipeCache.getRecipe(cacheKey);
    if (cachedRecipe !== undefined) {
      return cachedRecipe;
    }

    // Generate request key for deduplication - include language
    const requestKey = cacheKey;

    // Return existing request if one is in progress
    if (requestKey in inFlightRequests) {
      return inFlightRequests[requestKey];
    }

    // Create new request
    const requestPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('recipes')
          .select(getRecipeDetailQuery())
          .eq('id', id)
          .single() as PostgrestSingleResponse<RawRecipe>;

        if (error) {
          throw new Error(error.message);
        }

        // Cache the result with language-aware key
        await recipeCache.setRecipe(cacheKey, data ?? null);

        return data ?? null;
      } finally {
        // Clear request when completed
        delete inFlightRequests[requestKey];
      }
    })();

    // Store the promise
    inFlightRequests[requestKey] = requestPromise;
    return requestPromise;
  }
};

/**
 * Semantic search via the semantic-recipe-search edge function.
 * Used as a fallback when lexical search returns too few results.
 */
export async function semanticRecipeSearch(
  query: string,
  locale: string,
  limit: number = 10,
): Promise<{ recipeId: string; name: string; imageUrl?: string; totalTime: number; difficulty: string; portions: number }[]> {
  const functionsUrl = process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL;
  if (!functionsUrl) return [];

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return [];

    const response = await fetch(`${functionsUrl}/semantic-recipe-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ query, locale, limit }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.recipes || [];
  } catch {
    return [];
  }
}

export default recipeService;
