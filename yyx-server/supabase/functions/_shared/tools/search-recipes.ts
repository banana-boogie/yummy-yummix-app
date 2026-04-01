/**
 * Recipe Search Tool
 *
 * Searches the recipe database with filters and allergen warnings.
 * Returns RecipeCard[] for display, annotating matches with allergen
 * warnings rather than excluding them.
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
import {
  getAllergenMap,
  getLocalizedAllergenName,
  loadAllergenGroups,
  matchesAllergen,
} from "../allergen-filter.ts";
import { normalizeIngredient } from "../ingredient-normalization.ts";
import { searchRecipesHybrid } from "../rag/hybrid-search.ts";
import { validateSearchRecipesParams } from "./tool-validators.ts";
import { getBaseLanguage, pickTranslation } from "../locale-utils.ts";
import { wordStartMatch } from "../text-utils.ts";

// ============================================================
// Result types
// ============================================================

export interface DedupFilteredResult {
  results: [];
  allFilteredByDedup: true;
  message: string;
}

export type SearchRecipeResult = RecipeCard[] | DedupFilteredResult;

// ============================================================
// Types for Supabase query results
// ============================================================

interface TranslationRow {
  locale: string;
  name: string | null;
}

interface RecipeTagJoin {
  recipe_tags: {
    recipe_tag_translations: TranslationRow[];
    categories: string[];
  } | null;
}

interface RecipeSearchResult {
  id: string;
  recipe_translations: TranslationRow[];
  image_url: string | null;
  total_time: number;
  difficulty: "easy" | "medium" | "hard";
  portions: number;
  average_rating: number | null;
  rating_count: number | null;
  recipe_to_tag: RecipeTagJoin[];
}

interface IngredientTranslationRow {
  locale: string;
  name: string | null;
}

interface RecipeWithIngredients {
  id: string;
  recipe_ingredients: Array<{
    ingredients: {
      ingredient_translations: IngredientTranslationRow[];
    } | null;
  }>;
}

/**
 * Resolve a recipe name from translation rows using a locale chain.
 */
function resolveRecipeName(
  translations: TranslationRow[],
  localeChain: string[],
): string {
  const match = pickTranslation(translations, localeChain);
  return match?.name || "Untitled";
}

/**
 * Resolve a tag name from translation rows using a locale chain.
 */
function resolveTagName(
  translations: TranslationRow[],
  localeChain: string[],
): string {
  const match = pickTranslation(translations, localeChain);
  return match?.name || "";
}

// ============================================================
// Tool Definition (OpenAI Function Calling format)
// ============================================================

export const searchRecipesTool = {
  type: "function" as const,
  function: {
    name: "search_recipes",
    description:
      "Search the recipe database. THIS TOOL MUST BE CALLED FIRST before generate_custom_recipe. " +
      "Always search before generating — the catalog may already have what the user wants. " +
      "Use whenever the user mentions ANY food, dish, ingredient, or food category. " +
      "Returns recipe cards that match the filters. Recipes containing user allergens are " +
      "returned with warning labels rather than being excluded.",
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
 * Search recipes with filters and allergen warnings.
 * Tries hybrid (semantic + lexical) search when query and API key are present.
 * Falls back to lexical-only search on embedding failure.
 */
export async function searchRecipes(
  supabase: SupabaseClient,
  rawParams: unknown,
  userContext: UserContext,
): Promise<SearchRecipeResult> {
  // Validate and sanitize params
  const params = validateSearchRecipesParams(rawParams);

  console.log("[search] Entry", {
    hasQuery: !!params.query,
    queryLength: params.query?.length ?? 0,
    hasCuisine: !!params.cuisine,
    maxTime: params.maxTime ?? null,
    difficulty: params.difficulty ?? null,
    limit: params.limit ?? 10,
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

      // Filter out recipes already shown in this session
      const hybridCards = filterAlreadyShown(
        hybridResult.recipes,
        userContext.conversationHistory,
      );

      // Annotate recipes with allergen warnings instead of filtering
      if (
        userContext.dietaryRestrictions.length > 0 && hybridCards.length > 0
      ) {
        const recipeIds = hybridCards.map((r) => r.recipeId);
        const ingredientLookupResult = await fetchRecipesWithIngredients(
          supabase,
          recipeIds,
        );
        const annotation = await annotateAllergenWarnings(
          supabase,
          hybridCards,
          ingredientLookupResult.recipes,
          userContext.dietaryRestrictions,
          userContext.locale,
          ingredientLookupResult.failed,
        );
        console.log("[search] Hybrid allergen annotation", {
          total: annotation.cards.length,
          flagged: annotation.cards.filter((r) => r.allergenWarnings?.length)
            .length,
          verificationUnavailable: annotation.verificationUnavailable,
        });
        return annotation.cards;
      }
      return hybridCards;
    }

    // All degradation reasons (embedding_failure, no_semantic_candidates, low_confidence)
    // fall through to lexical search as graceful degradation.
    console.log(
      "[search] Hybrid returned no results, falling back to lexical",
      {
        method: hybridResult.method,
        degradationReason: hybridResult.degradationReason,
      },
    );
  }

  // Lexical search path (existing implementation)
  // Build base query with translation table joins
  let query = supabase
    .from("recipes")
    .select(`
      id,
      recipe_translations ( locale, name ),
      image_url,
      total_time,
      difficulty,
      portions,
      average_rating,
      rating_count,
      recipe_to_tag ( recipe_tags ( recipe_tag_translations ( locale, name ), categories ) )
    `)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  const hasQuery = !!params.query;

  // Preserve strict filtering for filter-only searches (no query text).
  if (!hasQuery && params.difficulty) {
    query = query.eq("difficulty", params.difficulty);
  }

  if (!hasQuery && params.maxTime) {
    query = query.lte("total_time", params.maxTime);
  }

  // Note: text search on recipe name at DB level now requires filtering
  // through the translation table. We use post-filtering since the translation
  // join makes DB-level ilike impractical with PostgREST.
  // For large datasets, this should be migrated to a full-text search RPC.

  // Fetch more than requested to allow for post-filtering (cuisine, allergens, text match)
  const fetchLimit = Math.max((params.limit || 10) * 5, 50);
  const { data, error } = await query.limit(fetchLimit);

  if (error) {
    console.error("[search] Recipe search error:", error);
    throw new Error("Failed to search recipes");
  }

  let results = (data || []) as unknown as RecipeSearchResult[];

  // Post-filter by query text across all translation names (word-start matching)
  // Uses AND logic for individual word terms: "miso soup" requires BOTH "miso" AND "soup".
  // The full multi-word phrase is an alternative match (OR with AND-terms).
  if (params.query) {
    const queryTerms = getSearchTerms(params.query);
    if (queryTerms.length > 0) {
      const individualTerms = queryTerms.filter((t) => !t.includes(" "));
      const fullPhrase = queryTerms.find((t) => t.includes(" "));
      results = results.filter((recipe) => {
        const allNames = (recipe.recipe_translations || [])
          .map((t) => t.name)
          .filter(Boolean)
          .map((n) => n!.toLowerCase());
        const phraseMatch = fullPhrase
          ? allNames.some((name) => wordStartMatch(name, fullPhrase))
          : false;
        const allTermsMatch = individualTerms.length > 0 &&
          individualTerms.every((term) =>
            allNames.some((name) => wordStartMatch(name, term))
          );
        return phraseMatch || allTermsMatch;
      });
    }
  }

  console.log("[search] Lexical name search", { count: results.length });

  // Pass 2: Tag-based search when name-only results are insufficient
  if (params.query && results.length < (params.limit || 10)) {
    const tagResults = await searchByTags(
      supabase,
      params.query,
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
    filtered = filterByCuisine(
      results,
      params.cuisine,
      userContext.localeChain,
    );
  }

  // Transform to RecipeCard format
  let recipeCards: RecipeCard[] = filtered.map((recipe) => ({
    recipeId: recipe.id,
    recipeTable: "recipes",
    name: resolveRecipeName(
      recipe.recipe_translations || [],
      userContext.localeChain,
    ),
    imageUrl: recipe.image_url || undefined,
    totalTime: recipe.total_time,
    difficulty: recipe.difficulty,
    portions: recipe.portions,
    ...(recipe.average_rating ? { averageRating: recipe.average_rating } : {}),
    ...(recipe.rating_count ? { ratingCount: recipe.rating_count } : {}),
  }));

  // Annotate recipes with allergen warnings instead of filtering
  if (userContext.dietaryRestrictions.length > 0 && recipeCards.length > 0) {
    const recipeIds = recipeCards.map((r) => r.recipeId);
    const ingredientLookupResult = await fetchRecipesWithIngredients(
      supabase,
      recipeIds,
    );

    const annotation = await annotateAllergenWarnings(
      supabase,
      recipeCards,
      ingredientLookupResult.recipes,
      userContext.dietaryRestrictions,
      userContext.locale,
      ingredientLookupResult.failed,
    );
    recipeCards = annotation.cards;
    console.log("[search] Allergen annotation", {
      total: recipeCards.length,
      flagged: recipeCards.filter((r) => r.allergenWarnings?.length).length,
      verificationUnavailable: annotation.verificationUnavailable,
    });
  }

  // Apply query-based relevance scoring
  if (params.query) {
    recipeCards = scoreByQuery(
      results,
      recipeCards,
      params.query,
      userContext.localeChain,
      params.difficulty,
      params.maxTime,
    );
  }

  // Filter out recipes already shown in this session
  const preDedupCount = recipeCards.length;
  recipeCards = filterAlreadyShown(
    recipeCards,
    userContext.conversationHistory,
  );

  // Apply final limit after all filtering and scoring
  const finalResults = recipeCards.slice(0, params.limit || 10);
  console.log("[search] Final results", {
    count: finalResults.length,
    preDedupCount,
  });

  // When dedup filters ALL results, tell the AI why so it can call generate_custom_recipe.
  // Returns an object instead of RecipeCard[] — safe because the result is JSON.stringify'd
  // into the tool message by the orchestrator.
  if (finalResults.length === 0 && preDedupCount > 0) {
    return {
      results: [],
      allFilteredByDedup: true,
      message:
        `${preDedupCount} recipe(s) matched "${params.query}" but were already shown. The user wants something new — call generate_custom_recipe.`,
    };
  }

  return finalResults;
}

// ============================================================
// Deduplication — filter recipes already shown in the session
// ============================================================

/**
 * Extract recipe IDs already shown in this conversation from message metadata.
 * Exported for testing.
 */
export function getAlreadyShownRecipeIds(
  conversationHistory: UserContext["conversationHistory"],
): Set<string> {
  const ids = new Set<string>();
  for (const msg of conversationHistory) {
    const recipes = msg.metadata?.recipes;
    if (Array.isArray(recipes)) {
      for (const r of recipes) {
        if (r?.recipeId) ids.add(r.recipeId);
      }
    }
  }
  return ids;
}

/**
 * Remove recipes that were already shown to the user in the current session.
 */
function filterAlreadyShown(
  results: RecipeCard[],
  conversationHistory: UserContext["conversationHistory"],
): RecipeCard[] {
  const shown = getAlreadyShownRecipeIds(conversationHistory);
  if (shown.size === 0) return results;
  const filtered = results.filter((r) => !shown.has(r.recipeId));
  if (filtered.length < results.length) {
    console.log("[search] Dedup filtered out", {
      before: results.length,
      after: filtered.length,
      removedIds: results
        .filter((r) => shown.has(r.recipeId))
        .map((r) => r.recipeId),
    });
  }
  return filtered;
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
  limit: number = 30,
): Promise<RecipeSearchResult[]> {
  // Search tag translations for matching names
  const terms = getSearchTerms(query);
  if (terms.length === 0) {
    return [];
  }

  // Find tag IDs by searching translations
  const tagTransFilter = terms.map((term) => `name.ilike.%${term}%`).join(",");
  const { data: matchingTranslations, error: tagError } = await supabase
    .from("recipe_tag_translations")
    .select("recipe_tag_id")
    .or(tagTransFilter);

  if (tagError || !matchingTranslations || matchingTranslations.length === 0) {
    return [];
  }

  const tagIds = [
    ...new Set(
      matchingTranslations.map(
        (t: { recipe_tag_id: string }) => t.recipe_tag_id,
      ),
    ),
  ];

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
  const recipeQuery = supabase
    .from("recipes")
    .select(`
      id,
      recipe_translations ( locale, name ),
      image_url,
      total_time,
      difficulty,
      portions,
      average_rating,
      rating_count,
      recipe_to_tag ( recipe_tags ( recipe_tag_translations ( locale, name ), categories ) )
    `)
    .in("id", recipeIds)
    .eq("is_published", true);

  const { data, error } = await recipeQuery.limit(limit);

  if (error || !data) {
    return [];
  }

  const tagResults = data as unknown as RecipeSearchResult[];
  return filterByAllKeywords(tagResults, query);
}

/**
 * For multi-word queries, post-filter to require ALL keywords match across tags.
 * Without this, "chicken pasta" returns any recipe tagged "chicken" OR "pasta".
 * Single-word queries pass through unfiltered.
 * Exported for testing.
 */
export function filterByAllKeywords(
  recipes: RecipeSearchResult[],
  query: string,
): RecipeSearchResult[] {
  const keywords = query.toLowerCase().split(/\s+/).filter((k) => k.length > 2);
  if (keywords.length <= 1 || recipes.length === 0) return recipes;

  return recipes.filter((recipe) => {
    const recipeTags = (recipe.recipe_to_tag || [])
      .map((join) => join.recipe_tags)
      .filter(Boolean)
      .flatMap((tag) =>
        (tag!.recipe_tag_translations || [])
          .map((t) => t.name)
          .filter(Boolean)
      )
      .map((t) => t!.toLowerCase());

    return keywords.every((keyword) =>
      recipeTags.some((tagName) => tagName.includes(keyword))
    );
  });
}

/**
 * Filter recipes by cuisine using tags (CULTURAL_CUISINE category).
 */
function filterByCuisine(
  data: RecipeSearchResult[],
  cuisine: string,
  localeChain: string[],
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

      // Check if the cuisine matches using any available translation
      const tagName = resolveTagName(
        tag.recipe_tag_translations || [],
        localeChain,
      );
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
  localeChain: string[],
  difficulty?: "easy" | "medium" | "hard",
  maxTime?: number,
): RecipeCard[] {
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter((k) => k.length > 2);

  const scored = cards.map((card) => {
    const original = data.find((r) => r.id === card.recipeId);
    if (!original) return { card, score: 0 };

    let score = 0;

    // Check recipe name (resolved from translations)
    const name = resolveRecipeName(
      original.recipe_translations || [],
      localeChain,
    ).toLowerCase();

    // Exact name match
    if (name === queryLower) {
      score += 100;
    } else if (wordStartMatch(name, queryLower)) {
      score += 50;
    }

    // Keyword matches in name
    for (const keyword of keywords) {
      if (wordStartMatch(name, keyword)) score += 10;
    }

    // Tag matches
    if (original.recipe_to_tag) {
      for (const join of original.recipe_to_tag) {
        const tag = join.recipe_tags;
        if (!tag) continue;

        const tagName = resolveTagName(
          tag.recipe_tag_translations || [],
          localeChain,
        ).toLowerCase();

        if (tagName.includes(queryLower)) score += 20;
        for (const keyword of keywords) {
          if (tagName.includes(keyword)) score += 5;
        }
      }
    }

    // Soft ranking for explicit constraints when query searches are broadened
    if (difficulty) {
      if (original.difficulty === difficulty) {
        score += 30;
      } else if (isAdjacentDifficulty(original.difficulty, difficulty)) {
        score += 10;
      }
    }

    // Soft difficulty signal — easier recipes get a slight boost when no explicit filter
    // (target audience prefers approachable recipes)
    if (!difficulty) {
      const difficultyBoost: Record<string, number> = {
        easy: 5,
        medium: 2,
        hard: 0,
      };
      score += difficultyBoost[original.difficulty] ?? 0;
    }

    if (maxTime) {
      if (original.total_time <= maxTime) {
        score += 25;
      } else if (original.total_time <= maxTime * 1.2) {
        score += 10;
      } else if (original.total_time <= maxTime * 1.5) {
        score += 3;
      } else {
        score -= 10;
      }
    }

    // Gentle rating boost — only for recipes with enough ratings to be trustworthy
    if (original.average_rating && (original.rating_count ?? 0) >= 3) {
      score += (original.average_rating - 3) * 8;
    }

    return { card, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.card);
}

function getSearchTerms(query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const terms = new Set<string>([normalized]);
  for (const part of normalized.split(/\s+/)) {
    if (part.length > 2) {
      terms.add(part);
    }
  }
  return [...terms];
}

function isAdjacentDifficulty(
  candidate: "easy" | "medium" | "hard",
  target: "easy" | "medium" | "hard",
): boolean {
  const difficultyOrder = { easy: 0, medium: 1, hard: 2 };
  return Math.abs(difficultyOrder[candidate] - difficultyOrder[target]) === 1;
}

/**
 * Annotate recipe cards with allergen warnings instead of filtering them out.
 * Checks each recipe's ingredients against the user's dietary restrictions
 * and attaches warning strings to flagged recipes.
 */
interface AllergenAnnotationResult {
  cards: RecipeCard[];
  verificationUnavailable: boolean;
}

/** Locale-keyed restriction labels. Extensible to new locales.
 *  Lookup order: full locale (e.g. "es-ES") -> base language ("es") -> "en".
 *
 *  NOTE: allergen_group_translations table now exists (migration 20260313145745).
 *  These hardcoded labels are kept for performance — they're used in hot search paths
 *  and change infrequently. Consider querying the DB if labels grow beyond this set.
 */
export const RESTRICTION_LABELS: Record<string, Record<string, string>> = {
  dairy: { en: "dairy", es: "lácteos" },
  eggs: { en: "eggs", es: "huevo" },
  egg: { en: "egg", es: "huevo" },
  fish: { en: "fish", es: "pescado" },
  gluten: { en: "gluten", es: "gluten" },
  nuts: { en: "tree nuts", es: "nueces", "es-ES": "frutos secos" },
  peanuts: { en: "peanuts", es: "cacahuates", "es-ES": "cacahuetes" },
  sesame: { en: "sesame", es: "sésamo" },
  shellfish: { en: "shellfish", es: "mariscos" },
  soy: { en: "soy", es: "soya" },
};

const VERIFICATION_WARNINGS: Record<string, string> = {
  es:
    "La verificación de alérgenos no está disponible temporalmente. Revisa los ingredientes antes de cocinar.",
  en:
    "Allergen verification is temporarily unavailable. Please check ingredients before cooking.",
};

/** Locale-keyed "Contains X (Y)" template for allergen warnings. */
const ALLERGEN_CONTAINS_TEMPLATE: Record<string, string> = {
  es: "Contiene {allergen} ({restriction})",
  en: "Contains {allergen} ({restriction})",
};

function getVerificationWarning(locale: string): string {
  const baseLang = getBaseLanguage(locale);
  return VERIFICATION_WARNINGS[baseLang] || VERIFICATION_WARNINGS["en"];
}

export function formatRestrictionLabel(
  restriction: string,
  locale: string,
): string {
  const normalized = restriction.toLowerCase().replace(/[_-]+/g, " ").trim();
  const known = RESTRICTION_LABELS[normalized];
  if (known) {
    // Try full locale first (e.g. "es-ES"), then base language ("es"), then "en"
    return known[locale] || known[getBaseLanguage(locale)] || known["en"] ||
      normalized;
  }
  return normalized;
}

function applyVerificationWarning(
  cards: RecipeCard[],
  locale: string,
): RecipeCard[] {
  const warning = getVerificationWarning(locale);
  return cards.map((card) => ({
    ...card,
    allergenVerificationWarning: warning,
  }));
}

async function annotateAllergenWarnings(
  supabase: SupabaseClient,
  cards: RecipeCard[],
  recipesWithIngredients: Array<{
    id: string;
    ingredientNames: string[];
  }>,
  userRestrictions: string[],
  locale: string,
  ingredientsFetchFailed = false,
): Promise<AllergenAnnotationResult> {
  if (userRestrictions.length === 0) {
    return { cards, verificationUnavailable: false };
  }

  if (ingredientsFetchFailed) {
    console.warn(
      "[search] Ingredient lookup unavailable; tagging results with verification warning",
    );
    return {
      cards: applyVerificationWarning(cards, locale),
      verificationUnavailable: true,
    };
  }

  const allergenMap = await getAllergenMap(supabase);
  if (allergenMap.size === 0) {
    console.warn(
      "[search] Allergen map empty; tagging results with verification warning",
    );
    return {
      cards: applyVerificationWarning(cards, locale),
      verificationUnavailable: true,
    };
  }

  const allergenEntries = await loadAllergenGroups(supabase);
  const baseLang = getBaseLanguage(locale);

  // Build ingredient lookup by recipe ID
  const ingredientsByRecipe = new Map(
    recipesWithIngredients.map((r) => [r.id, r.ingredientNames]),
  );

  // Pre-normalize all unique ingredient names
  const allNames = [
    ...new Set(recipesWithIngredients.flatMap((r) => r.ingredientNames)),
  ];
  const normalizedEntries = await Promise.all(
    allNames.map(async (name) =>
      [name, await normalizeIngredient(supabase, name, locale)] as const
    ),
  );
  const normalizedMap = new Map(normalizedEntries);

  const annotatedCards = cards.map((card) => {
    const ingredientNames = ingredientsByRecipe.get(card.recipeId) || [];
    const warnings: string[] = [];
    const matchedCategories = new Set<string>();

    for (const ingredientName of ingredientNames) {
      if (!ingredientName) continue;

      const normalized = normalizedMap.get(ingredientName) ?? ingredientName;

      for (const restriction of userRestrictions) {
        if (matchedCategories.has(restriction)) continue;
        const allergens = allergenMap.get(restriction) || [];

        for (const allergen of allergens) {
          if (
            normalized === allergen || matchesAllergen(normalized, allergen)
          ) {
            const allergenName = getLocalizedAllergenName(
              allergenEntries,
              allergen,
              locale,
            );
            const restrictionLabel = formatRestrictionLabel(
              restriction,
              locale,
            );

            const template = ALLERGEN_CONTAINS_TEMPLATE[baseLang] ||
              ALLERGEN_CONTAINS_TEMPLATE["en"];
            warnings.push(
              template
                .replace("{allergen}", allergenName)
                .replace("{restriction}", restrictionLabel),
            );
            matchedCategories.add(restriction);
            break;
          }
        }
      }
    }

    return warnings.length > 0 ? { ...card, allergenWarnings: warnings } : card;
  });

  return {
    cards: annotatedCards,
    verificationUnavailable: false,
  };
}

/**
 * Fetch recipes with ingredient names for allergen filtering.
 * Uses translation tables to get ingredient names in all locales.
 */
async function fetchRecipesWithIngredients(
  supabase: SupabaseClient,
  recipeIds: string[],
): Promise<{
  recipes: Array<{ id: string; ingredientNames: string[] }>;
  failed: boolean;
}> {
  if (recipeIds.length === 0) {
    return { recipes: [], failed: false };
  }

  const { data, error } = await supabase
    .from("recipes")
    .select(`
      id,
      recipe_ingredients ( ingredients ( ingredient_translations ( locale, name ) ) )
    `)
    .in("id", recipeIds);

  if (error || !data) {
    console.error("[search] Failed to fetch recipe ingredients:", error);
    return { recipes: [], failed: true };
  }

  return {
    recipes: (data as unknown as RecipeWithIngredients[]).map((recipe) => ({
      id: recipe.id,
      ingredientNames: (recipe.recipe_ingredients || [])
        .filter((ri) => ri.ingredients !== null)
        .flatMap((ri) =>
          (ri.ingredients!.ingredient_translations || [])
            .map((t) => t.name)
            .filter((n): n is string => !!n)
        ),
    })),
    failed: false,
  };
}
