/**
 * Hybrid Search Module
 *
 * Combines semantic vector similarity with lexical scoring for recipe discovery.
 * Falls back to lexical-only when embedding API is unavailable.
 * Per irmixy-completion-plan.md Sections 4.2, 6.5, 6.10
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { RecipeCard, UserContext } from "../irmixy-schemas.ts";
import { embed } from "../ai-gateway/index.ts";

// ============================================================
// Query Embedding Cache (per-instance, best-effort)
// Edge Functions are ephemeral — this only helps within a single instance
// ============================================================

const embeddingCache = new Map<
  string,
  { embedding: number[]; expires: number }
>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 5_000;

// ============================================================
// Types
// ============================================================

interface SemanticMatch {
  recipe_id: string;
  similarity: number;
}

export interface HybridSearchFilters {
  cuisine?: string;
  maxTime?: number;
  difficulty?: "easy" | "medium" | "hard";
  limit?: number;
}

export interface HybridSearchResult {
  recipes: RecipeCard[];
  method: "hybrid" | "lexical";
  degradationReason?:
    | "embedding_failure"
    | "no_semantic_candidates"
    | "low_confidence";
}

interface RecipeTagJoin {
  recipe_tags: {
    name_en: string | null;
    name_es: string | null;
    categories: string[];
  } | null;
}

interface RecipeRow {
  id: string;
  name_en: string | null;
  name_es: string | null;
  image_url: string | null;
  total_time: number;
  difficulty: "easy" | "medium" | "hard";
  portions: number;
  recipe_to_tag: RecipeTagJoin[];
}

interface ScoredRecipe {
  recipeId: string;
  name: string;
  imageUrl?: string;
  totalTime: number;
  difficulty: "easy" | "medium" | "hard";
  portions: number;
  finalScore: number;
}

// ============================================================
// Hybrid Scoring Weights (per plan Section 6.5)
// ============================================================

const SEMANTIC_WEIGHT = 0.40;
const LEXICAL_WEIGHT = 0.35;
const METADATA_WEIGHT = 0.10;
const PERSONALIZATION_WEIGHT = 0.15;

// Thresholds
const INCLUDE_THRESHOLD = 0.35;

// ============================================================
// Embedding
// ============================================================

/**
 * Generate an embedding for a search query via the AI Gateway.
 * Results are cached per-instance for 10 minutes (best-effort).
 */
export async function embedQuery(query: string): Promise<number[]> {
  const cacheKey = query.toLowerCase().trim();
  const cached = embeddingCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.embedding;
  }

  const response = await embed({ usageType: "embedding", text: query });
  const embedding = response.embedding;

  // Cache with LRU eviction
  if (embeddingCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = embeddingCache.keys().next().value;
    if (oldestKey) embeddingCache.delete(oldestKey);
  }
  embeddingCache.set(cacheKey, {
    embedding,
    expires: Date.now() + CACHE_TTL_MS,
  });

  return embedding;
}

// ============================================================
// Semantic Search
// ============================================================

/**
 * Search recipe embeddings using vector similarity via match_recipe_embeddings RPC.
 */
async function semanticSearch(
  supabase: SupabaseClient,
  queryEmbedding: number[],
  matchCount: number = 50,
): Promise<SemanticMatch[]> {
  const { data, error } = await supabase.rpc("match_recipe_embeddings", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: 0.0,
    match_count: matchCount,
  });

  if (error) {
    console.error("[hybrid-search] Semantic search RPC error:", error.message);
    return [];
  }

  return (data || []) as SemanticMatch[];
}

// ============================================================
// Scoring Functions
// ============================================================

/**
 * Compute normalized lexical score for a recipe against a query.
 * Reuses scoring logic from search-recipes.ts, normalized to [0,1].
 */
function computeLexicalScore(
  recipeName: string,
  tagNames: string[],
  query: string,
): number {
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter((k) => k.length > 2);
  const nameLower = recipeName.toLowerCase();

  let rawScore = 0;

  // Name matching
  if (nameLower === queryLower) {
    rawScore += 100;
  } else if (nameLower.includes(queryLower)) {
    rawScore += 50;
  }

  for (const keyword of keywords) {
    if (nameLower.includes(keyword)) rawScore += 10;
  }

  // Tag matching
  for (const tagName of tagNames) {
    const tagLower = tagName.toLowerCase();
    if (tagLower.includes(queryLower)) rawScore += 20;
    for (const keyword of keywords) {
      if (tagLower.includes(keyword)) rawScore += 5;
    }
  }

  // Normalize to [0, 1] — max reasonable raw score ~150
  return Math.min(rawScore / 150, 1.0);
}

/**
 * Compute metadata score based on how well recipe matches explicit constraints.
 */
function computeMetadataScore(
  recipe: { total_time: number; difficulty: string },
  filters: HybridSearchFilters,
): number {
  const difficultyOrder: Record<"easy" | "medium" | "hard", number> = {
    easy: 0,
    medium: 1,
    hard: 2,
  };

  let score = 0;
  let factors = 0;

  if (filters.maxTime) {
    factors++;
    if (recipe.total_time <= filters.maxTime) {
      score += 1;
    } else if (recipe.total_time <= filters.maxTime * 1.2) {
      score += 0.5;
    } else if (recipe.total_time <= filters.maxTime * 1.5) {
      score += 0.2;
    }
  }

  if (filters.difficulty) {
    factors++;
    if (recipe.difficulty === filters.difficulty) {
      score += 1;
    } else if (
      recipe.difficulty in difficultyOrder &&
      Math.abs(
          difficultyOrder[recipe.difficulty as "easy" | "medium" | "hard"] -
            difficultyOrder[filters.difficulty],
        ) === 1
    ) {
      score += 0.4;
    }
  }

  return factors > 0 ? score / factors : 0.5;
}

/**
 * Compute personalization score based on user cuisine preferences.
 */
function computePersonalizationScore(
  tagNames: string[],
  userContext: UserContext,
): number {
  if (userContext.cuisinePreferences.length === 0) return 0.5;

  const cuisineTags = tagNames.map((t) => t.toLowerCase());
  for (const pref of userContext.cuisinePreferences) {
    if (cuisineTags.some((t) => t.includes(pref.toLowerCase()))) {
      return 1.0;
    }
  }

  return 0.0;
}

// ============================================================
// Main Hybrid Search
// ============================================================

/**
 * Perform hybrid search combining semantic and lexical approaches.
 * Falls back gracefully when embedding API is unavailable.
 *
 * Returns empty recipes with method="lexical" to signal caller
 * should use the existing lexical path.
 */
export async function searchRecipesHybrid(
  supabase: SupabaseClient,
  query: string,
  filters: HybridSearchFilters,
  userContext: UserContext,
  semanticSupabase: SupabaseClient = supabase,
): Promise<HybridSearchResult> {
  // Try to generate query embedding with graceful fallback
  let queryEmbedding: number[] | null = null;
  const embedStart = performance.now();
  try {
    queryEmbedding = await embedQuery(query);
    console.log("[hybrid-search] Embedding generated", {
      queryLength: query.length,
      hasQuery: query.length > 0,
      dimensions: queryEmbedding.length,
      ms: Math.round(performance.now() - embedStart),
    });
  } catch (err) {
    console.warn(
      "[hybrid-search] Embedding failed, falling back to lexical:",
      err instanceof Error ? err.message : String(err),
    );
  }

  if (!queryEmbedding) {
    return {
      recipes: [],
      method: "lexical",
      degradationReason: "embedding_failure",
    };
  }

  // Get semantic matches from vector search
  const semanticMatches = await semanticSearch(
    semanticSupabase,
    queryEmbedding,
    50,
  );

  console.log("[hybrid-search] Semantic matches", {
    total: semanticMatches.length,
    bestSimilarity: semanticMatches[0]?.similarity?.toFixed(3) ?? null,
  });

  if (semanticMatches.length === 0) {
    return {
      recipes: [],
      method: "hybrid",
      degradationReason: "no_semantic_candidates",
    };
  }

  // Fetch full recipe data for semantic candidates
  const recipeIds = semanticMatches.map((m) => m.recipe_id);
  const { data: recipesData, error: recipesError } = await supabase
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

  if (recipesError || !recipesData) {
    console.error(
      "[hybrid-search] Failed to fetch recipe data:",
      recipesError?.message,
    );
    return {
      recipes: [],
      method: "lexical",
      degradationReason: "embedding_failure",
    };
  }

  const recipes = recipesData as unknown as RecipeRow[];

  // Build semantic score map
  const semanticScoreMap = new Map(
    semanticMatches.map((m) => [m.recipe_id, m.similarity]),
  );

  // Score all recipes
  const scored: ScoredRecipe[] = recipes.map((recipe) => {
    const name =
      (userContext.language === "es" ? recipe.name_es : recipe.name_en) || "";
    const tagNames = (recipe.recipe_to_tag || [])
      .map((join) => {
        const tag = join.recipe_tags;
        if (!tag) return "";
        return (userContext.language === "es" ? tag.name_es : tag.name_en) ||
          "";
      })
      .filter(Boolean);

    const semanticScore = semanticScoreMap.get(recipe.id) || 0;
    const lexicalScore = query ? computeLexicalScore(name, tagNames, query) : 0;
    const metadataScore = computeMetadataScore(recipe, filters);
    const personalizationScore = computePersonalizationScore(
      tagNames,
      userContext,
    );

    const finalScore = SEMANTIC_WEIGHT * semanticScore +
      LEXICAL_WEIGHT * lexicalScore +
      METADATA_WEIGHT * metadataScore +
      PERSONALIZATION_WEIGHT * personalizationScore;

    return {
      recipeId: recipe.id,
      name,
      imageUrl: recipe.image_url || undefined,
      totalTime: recipe.total_time,
      difficulty: recipe.difficulty,
      portions: recipe.portions,
      finalScore,
    };
  });

  // Apply threshold and sort
  const aboveThreshold = scored
    .filter((r) => r.finalScore >= INCLUDE_THRESHOLD)
    .sort((a, b) => b.finalScore - a.finalScore);

  // Fall back to lexical only when zero recipes pass the include threshold
  const needsFallback = aboveThreshold.length === 0;

  console.log("[hybrid-search] Threshold filtering", {
    totalScored: scored.length,
    aboveThreshold: aboveThreshold.length,
    topScore: (aboveThreshold[0]?.finalScore || 0).toFixed(3),
    needsFallback,
  });

  if (needsFallback) {
    return {
      recipes: [],
      method: "hybrid",
      degradationReason: "low_confidence",
    };
  }

  // Convert to RecipeCard format
  const limit = filters.limit || 10;
  const resultCards: RecipeCard[] = aboveThreshold
    .slice(0, limit)
    .map((r) => ({
      recipeId: r.recipeId,
      name: r.name,
      imageUrl: r.imageUrl,
      totalTime: r.totalTime,
      difficulty: r.difficulty,
      portions: r.portions,
    }));

  console.log("[hybrid-search] Hybrid results", {
    total: scored.length,
    aboveThreshold: aboveThreshold.length,
    returned: resultCards.length,
    topScore: aboveThreshold[0]?.finalScore.toFixed(3),
  });

  return { recipes: resultCards, method: "hybrid" };
}

/**
 * Clear the embedding cache (useful for tests).
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}
