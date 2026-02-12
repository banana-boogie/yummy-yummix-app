/**
 * Retrieve Custom Recipe Tool
 *
 * Looks up a user's previously saved custom recipes by natural language description.
 * Supports disambiguation when multiple recipes match.
 * Per irmixy-completion-plan.md Section 6.6
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SuggestionChip, UserContext } from "../irmixy-schemas.ts";
import { validateRetrieveCustomRecipeParams } from "./tool-validators.ts";

// ============================================================
// Types
// ============================================================

export interface RetrieveCustomRecipeParams {
  query: string;
  timeframe?: string;
}

interface UserRecipeRow {
  id: string;
  name: string;
  description: string | null;
  recipe_data: Record<string, unknown> | null;
  source: string;
  created_at: string;
  updated_at: string;
}

interface ScoredCandidate {
  userRecipeId: string;
  name: string;
  createdAt: string;
  source: string;
  confidence: number;
}

export type RetrieveCustomRecipeResult =
  | {
    version: "1.0";
    type: "single";
    recipe: {
      userRecipeId: string;
      name: string;
      createdAt: string;
      source: string;
    };
    suggestions: SuggestionChip[];
  }
  | {
    version: "1.0";
    type: "multiple";
    recipes: Array<{
      userRecipeId: string;
      name: string;
      createdAt: string;
      confidence: number;
    }>;
    suggestions: SuggestionChip[];
  }
  | {
    version: "1.0";
    type: "not_found";
    suggestions: SuggestionChip[];
  };

// ============================================================
// Tool Definition (OpenAI Function Calling format)
// ============================================================

export const retrieveCustomRecipeTool = {
  type: "function" as const,
  function: {
    name: "retrieve_custom_recipe",
    description:
      "Look up a user's previously created custom recipe by description. " +
      "Use when the user references a past recipe they made (e.g., 'that chicken recipe', " +
      "'the pasta from last week'). Returns the matching recipe(s) for replay.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'What the user is looking for, e.g. "chicken stir fry", "that pasta recipe"',
        },
        timeframe: {
          type: "string",
          description:
            'Optional time reference, e.g. "last week", "yesterday", "January"',
        },
      },
      required: ["query"],
    },
  },
};

// ============================================================
// Constants
// ============================================================

const MAX_CANDIDATES = 50;
const MAX_DISAMBIGUATION = 3;
const SINGLE_CONFIDENCE_RATIO = 1.4; // Top must be 1.4x second to be "single"
const MIN_CONFIDENCE_THRESHOLD = 0.15;

// ============================================================
// Timeframe Parsing
// ============================================================

/**
 * Parse a natural-language timeframe into a Date range.
 * Returns null if timeframe is not recognized.
 */
function parseTimeframe(
  timeframe: string,
): { after: Date; before: Date } | null {
  const now = new Date();
  const lower = timeframe.toLowerCase().trim();

  // Relative references
  if (/yesterday/i.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { after: d, before: end };
  }

  if (/last\s+week/i.test(lower)) {
    const end = new Date(now);
    end.setDate(end.getDate() - ((end.getDay() + 6) % 7)); // Start of this week
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return { after: start, before: end };
  }

  if (/this\s+week/i.test(lower)) {
    const start = new Date(now);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
    return { after: start, before: now };
  }

  if (/last\s+month/i.test(lower)) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { after: start, before: end };
  }

  // Days ago pattern: "2 days ago", "a few days ago"
  const daysMatch = lower.match(/(\d+)\s*days?\s*ago/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    if (days > 0 && days <= 365) {
      const start = new Date(now);
      start.setDate(start.getDate() - days - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setDate(end.getDate() - days + 1);
      end.setHours(23, 59, 59, 999);
      return { after: start, before: end };
    }
  }

  // Month name: "January", "febrero"
  const months: Record<string, number> = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto: 7,
    septiembre: 8,
    octubre: 9,
    noviembre: 10,
    diciembre: 11,
  };

  for (const [name, idx] of Object.entries(months)) {
    if (lower.includes(name)) {
      let year = now.getFullYear();
      if (idx > now.getMonth()) year--; // Assume previous year if month is in future
      const start = new Date(year, idx, 1);
      const end = new Date(year, idx + 1, 0, 23, 59, 59, 999);
      return { after: start, before: end };
    }
  }

  return null;
}

// ============================================================
// Scoring
// ============================================================

/**
 * Score a candidate recipe against the search query.
 * Uses keyword overlap + timeframe proximity + recency.
 */
function scoreCandidate(
  recipe: UserRecipeRow,
  queryKeywords: string[],
  timeRange: { after: Date; before: Date } | null,
): number {
  let score = 0;

  const nameLower = (recipe.name || "").toLowerCase();

  // Keyword matching on name
  for (const keyword of queryKeywords) {
    if (nameLower.includes(keyword)) {
      score += 0.3;
    }
  }

  // Full query match in name
  const fullQuery = queryKeywords.join(" ");
  if (nameLower.includes(fullQuery)) {
    score += 0.2;
  }

  // Exact name match
  if (nameLower === fullQuery) {
    score += 0.3;
  }

  // Ingredient matching from recipe_data
  if (recipe.recipe_data && Array.isArray(recipe.recipe_data.ingredients)) {
    const ingredients = recipe.recipe_data.ingredients as Array<
      { name?: string }
    >;
    const ingredientNames = ingredients
      .map((i) => (i.name || "").toLowerCase())
      .filter(Boolean);

    for (const keyword of queryKeywords) {
      if (ingredientNames.some((name) => name.includes(keyword))) {
        score += 0.15;
      }
    }
  }

  // Timeframe matching
  if (timeRange) {
    const createdAt = new Date(recipe.created_at);
    if (createdAt >= timeRange.after && createdAt <= timeRange.before) {
      score += 0.3; // Strong boost for matching timeframe
    }
  }

  // Recency bonus (more recent = small bonus)
  const daysSinceCreation =
    (Date.now() - new Date(recipe.created_at).getTime()) /
    (1000 * 60 * 60 * 24);
  if (daysSinceCreation <= 7) {
    score += 0.1;
  } else if (daysSinceCreation <= 30) {
    score += 0.05;
  }

  return score;
}

// ============================================================
// Main Retrieval
// ============================================================

/**
 * Retrieve user's custom recipes matching a natural language query.
 * Enforces ownership — only returns recipes belonging to the authenticated user.
 */
export async function retrieveCustomRecipe(
  supabase: SupabaseClient,
  rawParams: unknown,
  userContext: UserContext,
): Promise<RetrieveCustomRecipeResult> {
  const params = validateRetrieveCustomRecipeParams(rawParams);
  const language = userContext.language;
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Authenticated user required for retrieve_custom_recipe");
  }

  // Parse timeframe if provided
  const timeRange = params.timeframe ? parseTimeframe(params.timeframe) : null;

  // Fetch user's custom recipes (ownership enforced via RLS + query predicate)
  let query = supabase
    .from("user_recipes")
    .select(
      "id, name, description, recipe_data, source, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(MAX_CANDIDATES);

  // Apply timeframe filter at DB level if parsed successfully
  if (timeRange) {
    query = query
      .gte("created_at", timeRange.after.toISOString())
      .lte("created_at", timeRange.before.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error("[retrieve-custom-recipe] Query error:", error.message);
    return notFoundResult(language);
  }

  if (!data || data.length === 0) {
    return notFoundResult(language);
  }

  const recipes = data as UserRecipeRow[];

  // Extract keywords from query
  const queryKeywords = params.query
    .toLowerCase()
    .split(/\s+/)
    .filter((k) => k.length > 2);

  // Score all candidates
  const scored: ScoredCandidate[] = recipes
    .map((recipe) => ({
      userRecipeId: recipe.id,
      name: recipe.name || "Untitled",
      createdAt: recipe.created_at,
      source: recipe.source || "ai_generated",
      confidence: scoreCandidate(recipe, queryKeywords, timeRange),
    }))
    .filter((c) => c.confidence >= MIN_CONFIDENCE_THRESHOLD)
    .sort((a, b) => b.confidence - a.confidence);

  if (scored.length === 0) {
    return notFoundResult(language);
  }

  // Determine single vs multiple
  if (scored.length === 1) {
    return singleResult(scored[0], language);
  }

  const topScore = scored[0].confidence;
  const secondScore = scored[1].confidence;

  if (topScore >= secondScore * SINGLE_CONFIDENCE_RATIO) {
    return singleResult(scored[0], language);
  }

  // Multiple matches — return top candidates for disambiguation
  const topCandidates = scored.slice(0, MAX_DISAMBIGUATION);

  return {
    version: "1.0",
    type: "multiple",
    recipes: topCandidates.map((c) => ({
      userRecipeId: c.userRecipeId,
      name: c.name,
      createdAt: c.createdAt,
      confidence: Math.round(c.confidence * 100) / 100,
    })),
    suggestions: topCandidates.map((c) => {
      const date = new Date(c.createdAt);
      const dateStr = date.toLocaleDateString(
        language === "es" ? "es-MX" : "en-US",
        { month: "short", day: "numeric" },
      );
      return {
        label: `${c.name} (${dateStr})`,
        message: language === "es"
          ? `Quiero la receta "${c.name}" del ${dateStr}`
          : `I want the "${c.name}" recipe from ${dateStr}`,
      };
    }),
  };
}

// ============================================================
// Result Builders
// ============================================================

function singleResult(
  candidate: ScoredCandidate,
  language: "en" | "es",
): RetrieveCustomRecipeResult {
  return {
    version: "1.0",
    type: "single",
    recipe: {
      userRecipeId: candidate.userRecipeId,
      name: candidate.name,
      createdAt: candidate.createdAt,
      source: candidate.source,
    },
    suggestions: [
      {
        label: language === "es" ? "Cocinar de nuevo" : "Cook it again",
        message: language === "es" ? "Cocinar de nuevo" : "Cook it again",
      },
      {
        label: language === "es" ? "Modificar receta" : "Modify recipe",
        message: language === "es"
          ? "Quiero modificar esta receta"
          : "I want to modify this recipe",
      },
    ],
  };
}

function notFoundResult(language: "en" | "es"): RetrieveCustomRecipeResult {
  return {
    version: "1.0",
    type: "not_found",
    suggestions: [
      {
        label: language === "es"
          ? "Crear con ingredientes"
          : "Create from ingredients",
        message: language === "es"
          ? "Quiero crear una receta con mis ingredientes"
          : "I want to create a recipe from my ingredients",
      },
      {
        label: language === "es" ? "Sorpréndeme" : "Surprise me",
        message: language === "es"
          ? "Hazme una receta sorpresa"
          : "Make me a surprise recipe",
      },
    ],
  };
}
