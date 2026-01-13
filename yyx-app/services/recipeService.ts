import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';
import { RawRecipe } from '@/types/recipe.api.types';
import { PostgrestResponse, PostgrestSingleResponse } from '@supabase/supabase-js';
import { recipeCache } from '@/services/cache/recipeCache';
import { isValidUUID } from '@/utils/validation';

// Helper function to get current language suffix
const getLangSuffix = () => `_${i18n.locale}`;

// Helper to generate language-aware cache key
const getLanguageAwareKey = (baseKey: string) => `${baseKey}${getLangSuffix()}`;

const getRecipeListQuery = () => {
  const lang = getLangSuffix();
  return `
    id,
    name${lang},
    image_url,
    difficulty,
    prep_time,
    total_time,
    portions,
    is_published,
    created_at,
    updated_at,
    average_rating,
    rating_count,
    ingredients:recipe_ingredients (
      quantity,
      ingredient:ingredients (
        id,
        name${lang},
        plural_name${lang}
      )
    ),
    tags:recipe_to_tag (
      recipe_tags (
        id,
        name${lang}
      )
    )
  `;
};

const getRecipeDetailQuery = () => {
  const lang = getLangSuffix();
  return `
    id,
    name${lang},
    image_url,
    difficulty,
    prep_time,
    total_time,
    portions,
    tips_and_tricks${lang},
    is_published,
    average_rating,
    rating_count,
    steps:recipe_steps!inner (
      id,
      order,
      instruction${lang},
      recipe_section${lang},
      thermomix_time,
      thermomix_speed,
      thermomix_speed_start,
      thermomix_speed_end,
      thermomix_temperature,
      thermomix_is_blade_reversed,
      step_ingredients:recipe_step_ingredients (
        id,
        quantity,
        optional,
        display_order,
        ingredient:ingredients!inner (
          id,
          name${lang},
          plural_name${lang},
          image_url
        ),
        measurement_unit:measurement_units!inner (
          id,
          type,
          system,
          symbol${lang},
          symbol${lang}_plural,
          name${lang},
          name${lang}_plural
        )
      )
    ),
    ingredients:recipe_ingredients (
      quantity,
      notes${lang},
      recipe_section${lang},
      display_order,
      optional,
      ingredient:ingredients (
        id,
        name${lang},
        plural_name${lang},
        image_url
      ),
      measurement_unit:measurement_units !inner(
        id,
        type,
        system,
        symbol${lang},
        symbol${lang}_plural,
        name${lang},
        name${lang}_plural
      )
    ),
    tags:recipe_to_tag (
      recipe_tags!inner (
        id,
        name${lang}
      )
    ),
    useful_items:recipe_useful_items (
      id,
      notes${lang},
      display_order,
      useful_item:useful_items (
        id,
        name${lang},
        image_url
      )
    )
  `;
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

        // Apply search if provided
        if (searchTerm) {
          const langSuffix = getLangSuffix();
          query = query.ilike(`name${langSuffix}`, `%${searchTerm}%`);
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

        const response = await query as unknown as PostgrestResponse<RawRecipe[]>;

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

export default recipeService;