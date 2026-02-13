/**
 * Recipe Search Tool
 *
 * Searches the recipe database with filters and allergen exclusion.
 * Returns RecipeCard[] for display.
 */

import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.39.3";
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
 * Tries hybrid (semantic + lexical) search when query and API key are present.
 * Falls back to lexical-only search on embedding failure.
 */
export async function searchRecipes(
  supabase: SupabaseClient,
  rawParams: unknown,
  userContext: UserContext,
): Promise<RecipeCard[]> {
  // Validate and sanitize params
  const params = validateSearchRecipesParams(rawParams);

  console.log("[search] Entry", {
    query: params.query,
    cuisine: params.cuisine,
    maxTime: params.maxTime,
    difficulty: params.difficulty,
    limit: params.limit,
  });

  // Try hybrid search when query and API key are present
  if (params.query && Deno.env.get("OPENAI_API_KEY")) {
    // Embedding RPC is service-role only; use service client when available.
    const semanticSupabase = getSemanticSearchClient(supabase);
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
      semanticSupabase,
    );

    if (hybridResult.recipes.length > 0) {
      console.log("[search] Hybrid search returned results", {
        method: hybridResult.method,
        count: hybridResult.recipes.length,
      });
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
        const filtered = hybridResult.recipes.filter((r) =>
          safeIds.has(r.recipeId)
        );
        console.log("[search] Allergen filtering", {
          before: hybridResult.recipes.length,
          after: filtered.length,
        });
        return filtered;
      }
      return hybridResult.recipes;
    }

    // All degradation reasons (embedding_failure, no_semantic_candidates,
    // low_confidence) fall through to lexical search as graceful degradation.
    console.log(
      "[search] Hybrid returned no results, falling back to lexical",
      {
        method: hybridResult.method,
        degradationReason: hybridResult.degradationReason,
      },
    );
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
    console.error("[search] Recipe search error:", error);
    throw new Error("Failed to search recipes");
  }

  let results = (data || []) as unknown as RecipeSearchResult[];
  console.log("[search] Lexical name search", { count: results.length });

  // Pass 2: Tag-based search when name-only results are insufficient
  if (params.query && results.length < (params.limit || 10)) {
    const tagResults = await searchByTags(
      supabase,
      params.query,
      params.difficulty,
      params.maxTime,
      fetchLimit,
    );

    if (tagResults.length > 0) {
      // Merge and deduplicate by recipe ID
      const existingIds = new Set(results.map((r) => r.id));
      const newFromTags = tagResults.filter((r) => !existingIds.has(r.id));
      results = [...results, ...newFromTags];
      console.log("[search] Tag search added", {
        tagMatches: tagResults.length,
        newRecipes: newFromTags.length,
        totalAfterMerge: results.length,
      });
    }
  }

  if (results.length === 0) {
    console.log("[search] No lexical results found");
    return [];
  }

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
    const beforeCount = recipeCards.length;
    recipeCards = recipeCards.filter((r) => safeIds.has(r.recipeId));
    console.log("[search] Lexical allergen filtering", {
      before: beforeCount,
      after: recipeCards.length,
    });
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
  const finalResults = recipeCards.slice(0, params.limit || 10);
  console.log("[search] Final results", { count: finalResults.length });
  return finalResults;
}

// ============================================================
// Helpers
// ============================================================

// Module-level cache — edge function isolates are short-lived so a singleton
// is naturally scoped with no leak risk.
let _semanticClient: SupabaseClient | null = null;

function getSemanticSearchClient(
  defaultClient: SupabaseClient,
): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return defaultClient;

  if (!_semanticClient) {
    try {
      _semanticClient = createClient(url, key) as unknown as SupabaseClient;
    } catch (error) {
      console.warn(
        "[search-recipes] Failed to init service client:",
        error instanceof Error ? error.message : String(error),
      );
      return defaultClient;
    }
  }
  return _semanticClient;
}

/**
 * Search recipes by matching tag names via ILIKE.
 * Returns recipes where any associated tag name matches the query.
 */
async function searchByTags(
  supabase: SupabaseClient,
  query: string,
  difficulty?: "easy" | "medium" | "hard",
  maxTime?: number,
  limit: number = 30,
): Promise<RecipeSearchResult[]> {
  const searchTerm = `%${query}%`;

  // Find tag IDs matching the query
  const { data: matchingTags, error: tagError } = await supabase
    .from("recipe_tags")
    .select("id")
    .or(`name_en.ilike.${searchTerm},name_es.ilike.${searchTerm}`);

  if (tagError || !matchingTags || matchingTags.length === 0) {
    return [];
  }

  const tagIds = matchingTags.map((t: { id: string }) => t.id);

  // Find recipe IDs linked to those tags
  const { data: joins, error: joinError } = await supabase
    .from("recipe_to_tag")
    .select("recipe_id")
    .in("tag_id", tagIds);

  if (joinError || !joins || joins.length === 0) {
    return [];
  }

  const recipeIds = [
    ...new Set(joins.map((j: { recipe_id: string }) => j.recipe_id)),
  ];

  // Fetch full recipe data for those IDs
  let recipeQuery = supabase
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
    .in("id", recipeIds)
    .eq("is_published", true);

  if (difficulty) {
    recipeQuery = recipeQuery.eq("difficulty", difficulty);
  }
  if (maxTime) {
    recipeQuery = recipeQuery.lte("total_time", maxTime);
  }

  const { data, error } = await recipeQuery.limit(limit);

  if (error || !data) {
    return [];
  }

  return data as unknown as RecipeSearchResult[];
}

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
