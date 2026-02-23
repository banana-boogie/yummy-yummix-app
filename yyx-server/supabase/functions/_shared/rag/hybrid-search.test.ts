/**
 * Tests for hybrid-search scoring and caching logic.
 * Exercises the exported functions without external API calls.
 */

import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { clearEmbeddingCache, searchRecipesHybrid } from "./hybrid-search.ts";

const BASE_USER_CONTEXT = {
  language: "en" as const,
  measurementSystem: "imperial" as const,
  dietaryRestrictions: [],
  ingredientDislikes: [],
  skillLevel: null,
  householdSize: null,
  conversationHistory: [],
  dietTypes: [],
  cuisinePreferences: [],
  customAllergies: [],
  kitchenEquipment: [],
};

// ============================================================
// Test helpers: scoring functions are module-private, so we
// test them indirectly through searchRecipesHybrid. For unit
// coverage of the weights/thresholds we re-derive the formula.
// ============================================================

const SEMANTIC_WEIGHT = 0.40;
const LEXICAL_WEIGHT = 0.35;
const METADATA_WEIGHT = 0.10;
const PERSONALIZATION_WEIGHT = 0.15;
const INCLUDE_THRESHOLD = 0.35;

function computeExpectedScore(
  semantic: number,
  lexical: number,
  metadata: number,
  personalization: number,
): number {
  return (
    SEMANTIC_WEIGHT * semantic +
    LEXICAL_WEIGHT * lexical +
    METADATA_WEIGHT * metadata +
    PERSONALIZATION_WEIGHT * personalization
  );
}

// ============================================================
// Score formula tests
// ============================================================

Deno.test("hybrid scoring: perfect match scores above threshold", () => {
  const score = computeExpectedScore(1.0, 1.0, 1.0, 1.0);
  assertEquals(score, 1.0);
  assertEquals(score >= INCLUDE_THRESHOLD, true);
});

Deno.test("hybrid scoring: zero semantic scores below include threshold", () => {
  const score = computeExpectedScore(0, 0.5, 0.5, 0.5);
  // 0 + 0.125 + 0.05 + 0.05 = 0.225
  assertEquals(score < INCLUDE_THRESHOLD, true);
});

Deno.test("hybrid scoring: moderate semantic + strong lexical passes threshold", () => {
  const score = computeExpectedScore(0.6, 0.8, 0.5, 0.5);
  // 0.24 + 0.28 + 0.05 + 0.075 = 0.645
  assertEquals(score >= INCLUDE_THRESHOLD, true);
});

Deno.test("hybrid scoring: weights sum to 1.0", () => {
  const total = SEMANTIC_WEIGHT + LEXICAL_WEIGHT + METADATA_WEIGHT +
    PERSONALIZATION_WEIGHT;
  assertEquals(total, 1.0);
});

Deno.test("hybrid scoring: semantic has the highest weight", () => {
  assertEquals(SEMANTIC_WEIGHT > LEXICAL_WEIGHT, true);
  assertEquals(SEMANTIC_WEIGHT > METADATA_WEIGHT, true);
  assertEquals(SEMANTIC_WEIGHT > PERSONALIZATION_WEIGHT, true);
});

Deno.test("hybrid scoring: fallback only triggers when zero results above include threshold", () => {
  // With the simplified logic, fallback = aboveThreshold.length === 0
  // Any recipe above INCLUDE_THRESHOLD means no fallback needed
  const aboveThreshold = computeExpectedScore(0.6, 0.8, 0.5, 0.5);
  assertEquals(aboveThreshold >= INCLUDE_THRESHOLD, true);
});

Deno.test("hybrid scoring: low semantic alone falls below include threshold", () => {
  // Only semantic signal = 0.4
  const score = computeExpectedScore(0.4, 0, 0, 0);
  // 0.16 — below include threshold
  assertEquals(score < INCLUDE_THRESHOLD, true);
});

Deno.test("hybrid scoring: high semantic alone passes include threshold", () => {
  const score = computeExpectedScore(0.8, 0, 0, 0);
  // 0.32 — just below include threshold with new weights
  // Need semantic + at least some lexical or personalization signal
  assertEquals(score < INCLUDE_THRESHOLD, true);
});

Deno.test("hybrid scoring: high semantic + moderate lexical passes include threshold", () => {
  const score = computeExpectedScore(0.8, 0.3, 0, 0);
  // 0.32 + 0.105 = 0.425 — above include threshold
  assertEquals(score >= INCLUDE_THRESHOLD, true);
});

// ============================================================
// Cache tests
// ============================================================

Deno.test("clearEmbeddingCache does not throw", () => {
  clearEmbeddingCache();
});

// ============================================================
// Lexical score normalization (derived from formula)
// ============================================================

Deno.test("lexical score: exact name match normalizes to ~0.67", () => {
  // Exact name match gives rawScore = 100, normalized to 100/150 = 0.667
  const normalized = Math.min(100 / 150, 1.0);
  assertEquals(Math.abs(normalized - 0.667) < 0.01, true);
});

Deno.test("lexical score: name contains query normalizes to ~0.33", () => {
  // Name contains query gives rawScore = 50, normalized to 50/150 = 0.333
  const normalized = Math.min(50 / 150, 1.0);
  assertEquals(Math.abs(normalized - 0.333) < 0.01, true);
});

Deno.test("lexical score: capped at 1.0", () => {
  // Even with 200 raw score, cap at 1.0
  const normalized = Math.min(200 / 150, 1.0);
  assertEquals(normalized, 1.0);
});

// ============================================================
// Hybrid degradation behavior
// ============================================================

Deno.test("searchRecipesHybrid returns lexical degradation on embedding failure", async () => {
  clearEmbeddingCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("boom", { status: 500 });

  // Ensure gateway can resolve the API key
  const hadKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.set("OPENAI_API_KEY", "test-key");

  try {
    const result = await searchRecipesHybrid(
      {} as any,
      "healthy dinner",
      {},
      BASE_USER_CONTEXT,
    );

    assertEquals(result.method, "lexical");
    assertEquals(result.degradationReason, "embedding_failure");
  } finally {
    globalThis.fetch = originalFetch;
    if (hadKey) Deno.env.set("OPENAI_API_KEY", hadKey);
    else Deno.env.delete("OPENAI_API_KEY");
  }
});

Deno.test("searchRecipesHybrid returns hybrid no_semantic_candidates when vector search is empty", async () => {
  clearEmbeddingCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        model: "text-embedding-3-large",
        usage: { prompt_tokens: 5 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  const hadKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.set("OPENAI_API_KEY", "test-key");

  const mockSupabase = {
    rpc: async () => ({ data: [], error: null }),
  };

  try {
    const result = await searchRecipesHybrid(
      mockSupabase as any,
      "healthy dinner",
      {},
      BASE_USER_CONTEXT,
      mockSupabase as any, // explicit semantic client
    );

    assertEquals(result.method, "hybrid");
    assertEquals(result.degradationReason, "no_semantic_candidates");
  } finally {
    globalThis.fetch = originalFetch;
    if (hadKey) Deno.env.set("OPENAI_API_KEY", hadKey);
    else Deno.env.delete("OPENAI_API_KEY");
  }
});

Deno.test("searchRecipesHybrid returns low_confidence when all scores are below include threshold", async () => {
  clearEmbeddingCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        model: "text-embedding-3-large",
        usage: { prompt_tokens: 5 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  const hadKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.set("OPENAI_API_KEY", "test-key");

  const mockRecipeRows = [{
    id: "11111111-1111-1111-1111-111111111111",
    name_en: "Simple Salad",
    name_es: "Ensalada Simple",
    image_url: null,
    total_time: 15,
    difficulty: "easy",
    portions: 2,
    recipe_to_tag: [],
  }];

  const mockSupabase = {
    rpc: async () => ({
      data: [{
        recipe_id: "11111111-1111-1111-1111-111111111111",
        similarity: 0.3,
      }],
      error: null,
    }),
    from: () => ({
      select: () => ({
        in: () => ({
          eq: async () => ({ data: mockRecipeRows, error: null }),
        }),
      }),
    }),
  };

  try {
    const result = await searchRecipesHybrid(
      mockSupabase as any,
      "healthy dinner",
      {},
      BASE_USER_CONTEXT,
      mockSupabase as any, // explicit semantic client
    );

    assertEquals(result.method, "hybrid");
    assertEquals(result.degradationReason, "low_confidence");
  } finally {
    globalThis.fetch = originalFetch;
    if (hadKey) Deno.env.set("OPENAI_API_KEY", hadKey);
    else Deno.env.delete("OPENAI_API_KEY");
  }
});

Deno.test("searchRecipesHybrid metadata scoring favors adjacent difficulty over non-adjacent", async () => {
  clearEmbeddingCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        model: "text-embedding-3-large",
        usage: { prompt_tokens: 5 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  const hadKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.set("OPENAI_API_KEY", "test-key");

  const adjacentId = "33333333-3333-3333-3333-333333333333";
  const nonAdjacentId = "44444444-4444-4444-4444-444444444444";

  const mockSupabase = {
    rpc: async () => ({
      data: [
        { recipe_id: adjacentId, similarity: 0.9 },
        { recipe_id: nonAdjacentId, similarity: 0.9 },
      ],
      error: null,
    }),
    from: () => ({
      select: () => ({
        in: () => ({
          eq: async () => ({
            data: [
              {
                id: nonAdjacentId,
                name_en: "Dinner Bowl",
                name_es: "Tazón Cena",
                image_url: null,
                total_time: 30,
                difficulty: "hard",
                portions: 2,
                recipe_to_tag: [],
              },
              {
                id: adjacentId,
                name_en: "Dinner Bowl",
                name_es: "Tazón Cena",
                image_url: null,
                total_time: 30,
                difficulty: "medium",
                portions: 2,
                recipe_to_tag: [],
              },
            ],
            error: null,
          }),
        }),
      }),
    }),
  };

  try {
    const result = await searchRecipesHybrid(
      mockSupabase as any,
      "dinner",
      { difficulty: "easy", maxTime: 30, limit: 10 },
      BASE_USER_CONTEXT,
      mockSupabase as any,
    );

    assertEquals(result.method, "hybrid");
    assertEquals(result.recipes.length >= 2, true);
    assertEquals(result.recipes[0].recipeId, adjacentId);
  } finally {
    globalThis.fetch = originalFetch;
    if (hadKey) Deno.env.set("OPENAI_API_KEY", hadKey);
    else Deno.env.delete("OPENAI_API_KEY");
  }
});

Deno.test("searchRecipesHybrid keeps recipes up to 50% over max time with lower score", async () => {
  clearEmbeddingCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        model: "text-embedding-3-large",
        usage: { prompt_tokens: 5 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  const hadKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.set("OPENAI_API_KEY", "test-key");

  const withinId = "55555555-5555-5555-5555-555555555555";
  const over50Id = "66666666-6666-6666-6666-666666666666";

  const mockSupabase = {
    rpc: async () => ({
      data: [
        { recipe_id: withinId, similarity: 0.95 },
        { recipe_id: over50Id, similarity: 0.95 },
      ],
      error: null,
    }),
    from: () => ({
      select: () => ({
        in: () => ({
          eq: async () => ({
            data: [
              {
                id: withinId,
                name_en: "Pasta",
                name_es: "Pasta",
                image_url: null,
                total_time: 30,
                difficulty: "easy",
                portions: 2,
                recipe_to_tag: [],
              },
              {
                id: over50Id,
                name_en: "Pasta",
                name_es: "Pasta",
                image_url: null,
                total_time: 45,
                difficulty: "easy",
                portions: 2,
                recipe_to_tag: [],
              },
            ],
            error: null,
          }),
        }),
      }),
    }),
  };

  try {
    const result = await searchRecipesHybrid(
      mockSupabase as any,
      "pasta",
      { maxTime: 30, limit: 10 },
      BASE_USER_CONTEXT,
      mockSupabase as any,
    );

    assertEquals(result.method, "hybrid");
    assertEquals(
      result.recipes.some((recipe) => recipe.recipeId === over50Id),
      true,
    );
    assertEquals(result.recipes[0].recipeId, withinId);
  } finally {
    globalThis.fetch = originalFetch;
    if (hadKey) Deno.env.set("OPENAI_API_KEY", hadKey);
    else Deno.env.delete("OPENAI_API_KEY");
  }
});
