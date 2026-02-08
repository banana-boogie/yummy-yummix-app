/**
 * Recipe Search Tool
 *
 * Searches the recipe database with filters and allergen exclusion.
 * Returns RecipeCard[] for display.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  RecipeCard,
  SearchRecipesParams,
  UserContext,
} from "../irmixy-schemas.ts";
import { filterByAllergens } from "../allergen-filter.ts";
import { searchRecipesHybrid } from "../rag/hybrid-search.ts";
import { validateSearchRecipesParams } from "./tool-validators.ts";

// ============================================================
// Types for Supabase query results
// ============================================================

interface RecipeTagJoin {
  recipe_tags: {
    name_en: string | null;
    name_es: string | null;
    categories: string[];
  } | null;
}

interface RecipeSearchResult {
  id: string;
  name_en: string | null;
  name_es: string | null;
  image_url: string | null;
  total_time: number;
  difficulty: "easy" | "medium" | "hard";
  portions: number;
  recipe_to_tag: RecipeTagJoin[];
}

interface RecipeWithIngredients {
  id: string;
  recipe_ingredients: Array<{
    ingredients: {
      name_en: string | null;
      name_es: string | null;
    } | null;
  }>;
}

// ============================================================
// Tool Definition (OpenAI Function Calling format)
// ============================================================

export const searchRecipesTool = {
  type: "function" as const,
  function: {
    name: "search_recipes",
    description:
      "Search the recipe database for existing recipes based on user criteria. " +
      "Use this when the user wants to find recipes from the database (not create custom ones). " +
      "Returns recipe cards that match the filters. Results are automatically filtered by " +
      "the user's dietary restrictions and allergens.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'Natural language search query (e.g., "pasta", "healthy dinner", "chicken stir fry")',
        },
        cuisine: {
          type: "string",
          description:
            'Cuisine type filter (e.g., "Italian", "Asian", "Mexican", "Mediterranean")',
        },
        maxTime: {
          type: "integer",
          description: "Maximum total cooking time in minutes",
          minimum: 1,
          maximum: 480,
        },
        difficulty: {
          type: "string",
          enum: ["easy", "medium", "hard"],
          description: "Recipe difficulty level",
        },
        limit: {
          type: "integer",
          description: "Maximum number of results to return (default: 10)",
          minimum: 1,
          maximum: 20,
        },
      },
      required: [],
    },
  },
};

// ============================================================
// Search Implementation
// ============================================================

/**
 * Search recipes with filters and allergen exclusion.
 * Tries hybrid (semantic + lexical) search when feature flag is enabled.
 * Falls back to lexical-only search on embedding failure or when flag is off.
 */
export async function searchRecipes(
  supabase: SupabaseClient,
  rawParams: unknown,
  userContext: UserContext,
  openaiApiKey?: string,
): Promise<RecipeCard[]> {
  // Validate and sanitize params
  const params = validateSearchRecipesParams(rawParams);

  // Try hybrid search when feature flag is enabled and query is present
  const hybridEnabled = Deno.env.get("FEATURE_HYBRID_SEARCH") === "true";
  if (hybridEnabled && params.query && openaiApiKey) {
    const hybridResult = await searchRecipesHybrid(
      supabase,
      params.query,
      {
        cuisine: params.cuisine,
        maxTime: params.maxTime,
        difficulty: params.difficulty,
        limit: params.limit,
      },
      userContext,
      openaiApiKey,
    );

    if (hybridResult.recipes.length > 0) {
      // Hybrid returned results — apply allergen filtering then return
      if (userContext.dietaryRestrictions.length > 0) {
        const recipeIds = hybridResult.recipes.map((r) => r.recipeId);
        const recipesWithIngredients = await fetchRecipesWithIngredients(
          supabase,
          recipeIds,
        );
        const safeRecipes = await filterByAllergens(
          supabase,
          recipesWithIngredients,
          userContext.dietaryRestrictions,
          userContext.language,
        );
        const safeIds = new Set(safeRecipes.map((r) => r.id));
        return hybridResult.recipes.filter((r) => safeIds.has(r.recipeId));
      }
      return hybridResult.recipes;
    }

    // low_confidence means hybrid ran fully and found nothing good —
    // signal orchestrator to show deterministic no-results fallback.
    if (
      hybridResult.method === "hybrid" &&
      hybridResult.degradationReason === "low_confidence"
    ) {
      return [];
    }

    // embedding_failure and no_semantic_candidates fall through
    // to lexical search as graceful degradation.
  }

  // Lexical search path (existing implementation)
  // Build base query with correct column names and joins
  let query = supabase
    .from("recipes")
    .select(`
      id,
      name_en,
      name_es,
      image_url,
      total_time,
      difficulty,
      portions,
      recipe_to_tag ( recipe_tags ( name_en, name_es, categories ) )
    `)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  // Apply difficulty filter
  if (params.difficulty) {
    query = query.eq("difficulty", params.difficulty);
  }

  // Apply time filter
  if (params.maxTime) {
    query = query.lte("total_time", params.maxTime);
  }

  // Apply text search on recipe name at DB level
  if (params.query) {
    const searchTerm = `%${params.query}%`;
    query = query.or(`name_en.ilike.${searchTerm},name_es.ilike.${searchTerm}`);
  }

  // Fetch more than requested to allow for post-filtering (cuisine, allergens)
  const fetchLimit = Math.max((params.limit || 10) * 3, 30);
  const { data, error } = await query.limit(fetchLimit);

  if (error) {
    console.error("Recipe search error:", error);
    throw new Error("Failed to search recipes");
  }

  if (!data || data.length === 0) {
    return [];
  }

  const results = data as unknown as RecipeSearchResult[];

  // Filter by cuisine if specified (in-memory using tags)
  let filtered: RecipeSearchResult[] = results;
  if (params.cuisine) {
    filtered = filterByCuisine(results, params.cuisine, userContext.language);
  }

  // Transform to RecipeCard format
  let recipeCards: RecipeCard[] = filtered.map((recipe) => ({
    recipeId: recipe.id,
    name: (userContext.language === "es" ? recipe.name_es : recipe.name_en) ||
      "Untitled",
    imageUrl: recipe.image_url || undefined,
    totalTime: recipe.total_time,
    difficulty: recipe.difficulty,
    portions: recipe.portions,
  }));

  // Filter by user's dietary restrictions (allergen-based)
  if (userContext.dietaryRestrictions.length > 0 && recipeCards.length > 0) {
    const recipeIds = recipeCards.map((r) => r.recipeId);
    const recipesWithIngredients = await fetchRecipesWithIngredients(
      supabase,
      recipeIds,
    );

    const safeRecipes = await filterByAllergens(
      supabase,
      recipesWithIngredients,
      userContext.dietaryRestrictions,
      userContext.language,
    );

    const safeIds = new Set(safeRecipes.map((r) => r.id));
    recipeCards = recipeCards.filter((r) => safeIds.has(r.recipeId));
  }

  // Apply query-based relevance scoring
  if (params.query) {
    recipeCards = scoreByQuery(
      results,
      recipeCards,
      params.query,
      userContext.language,
    );
  }

  // Apply final limit after all filtering and scoring
  return recipeCards.slice(0, params.limit || 10);
}

// ============================================================
// Helpers
// ============================================================

/**
 * Filter recipes by cuisine using tags (CULTURAL_CUISINE category).
 */
function filterByCuisine(
  data: RecipeSearchResult[],
  cuisine: string,
  language: "en" | "es",
): RecipeSearchResult[] {
  const cuisineLower = cuisine.toLowerCase();

  return data.filter((recipe) => {
    if (!recipe.recipe_to_tag || recipe.recipe_to_tag.length === 0) {
      return false;
    }

    return recipe.recipe_to_tag.some((join) => {
      const tag = join.recipe_tags;
      if (!tag) return false;

      // Check if this is a CULTURAL_CUISINE tag
      if (!tag.categories || !tag.categories.includes("CULTURAL_CUISINE")) {
        return false;
      }

      // Check if the cuisine matches
      const tagName = (language === "es" ? tag.name_es : tag.name_en) || "";
      return tagName.toLowerCase().includes(cuisineLower);
    });
  });
}

/**
 * Score recipes by relevance to search query.
 * Simple keyword matching for Phase 1; semantic search in Phase 3.
 */
function scoreByQuery(
  data: RecipeSearchResult[],
  cards: RecipeCard[],
  query: string,
  language: "en" | "es",
): RecipeCard[] {
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter((k) => k.length > 2);

  const scored = cards.map((card) => {
    const original = data.find((r) => r.id === card.recipeId);
    if (!original) return { card, score: 0 };

    let score = 0;

    // Check recipe name
    const name =
      ((language === "es" ? original.name_es : original.name_en) || "")
        .toLowerCase();

    // Exact name match
    if (name === queryLower) {
      score += 100;
    } else if (name.includes(queryLower)) {
      score += 50;
    }

    // Keyword matches in name
    for (const keyword of keywords) {
      if (name.includes(keyword)) score += 10;
    }

    // Tag matches
    if (original.recipe_to_tag) {
      for (const join of original.recipe_to_tag) {
        const tag = join.recipe_tags;
        if (!tag) continue;

        const tagName = ((language === "es" ? tag.name_es : tag.name_en) || "")
          .toLowerCase();

        if (tagName.includes(queryLower)) score += 20;
        for (const keyword of keywords) {
          if (tagName.includes(keyword)) score += 5;
        }
      }
    }

    return { card, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.card);
}

/**
 * Fetch recipes with full ingredient data for allergen filtering.
 * Returns bilingual ingredient names for proper normalization.
 */
async function fetchRecipesWithIngredients(
  supabase: SupabaseClient,
  recipeIds: string[],
): Promise<
  Array<
    { id: string; ingredients: Array<{ name_en: string; name_es: string }> }
  >
> {
  const { data, error } = await supabase
    .from("recipes")
    .select(`
      id,
      recipe_ingredients ( ingredients ( name_en, name_es ) )
    `)
    .in("id", recipeIds);

  if (error || !data) {
    console.error("Failed to fetch recipe ingredients:", error);
    return [];
  }

  return (data as unknown as RecipeWithIngredients[]).map((recipe) => ({
    id: recipe.id,
    ingredients: (recipe.recipe_ingredients || [])
      .filter((ri) => ri.ingredients !== null)
      .map((ri) => ({
        name_en: ri.ingredients!.name_en || "",
        name_es: ri.ingredients!.name_es || "",
      })),
  }));
}
