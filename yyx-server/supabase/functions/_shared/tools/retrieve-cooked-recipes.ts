/**
 * Retrieve Cooked Recipes Tool
 *
 * Looks up recipes the user has previously cooked from analytics history.
 * Supports optional fuzzy name matching and optional timeframe filtering.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { RecipeCard, UserContext } from "../irmixy-schemas.ts";
import { parseNaturalLanguageTimeframe } from "./timeframe-parser.ts";
import { validateRetrieveCookedRecipesParams } from "./tool-validators.ts";

interface CookedRecipeRow {
  recipe_id: string;
  recipe_table: string;
  name: string | null;
  image_url: string | null;
  total_time: number | null;
  difficulty: string | null;
  portions: number | null;
  last_cooked_at: string;
}

const DEFAULT_LIMIT = 5;

export const retrieveCookedRecipesTool = {
  type: "function" as const,
  function: {
    name: "retrieve_cooked_recipes",
    description: "Retrieve recipes the user has previously cooked. " +
      "If query is provided, match by recipe name (fuzzy + substring). " +
      "If query is omitted, return the most recently cooked recipes. " +
      "Use for requests like 'show me what I cooked last time' or 'that dressing we made last week'.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional recipe name hint, e.g. 'chipotle dressing'",
        },
        timeframe: {
          type: "string",
          description:
            "Optional time reference, e.g. 'last week', 'yesterday', 'January'",
        },
      },
      required: [],
    },
  },
};

function normalizeDifficulty(
  value: string | null,
): "easy" | "medium" | "hard" {
  if (value === "easy" || value === "medium" || value === "hard") {
    return value;
  }
  return "easy";
}

export async function retrieveCookedRecipes(
  supabase: SupabaseClient,
  rawParams: unknown,
  userContext: UserContext,
): Promise<RecipeCard[]> {
  const params = validateRetrieveCookedRecipesParams(rawParams);
  const timeRange = params.timeframe
    ? parseNaturalLanguageTimeframe(params.timeframe)
    : null;

  const { data, error } = await supabase.rpc("get_cooked_recipes", {
    p_language: userContext.language,
    p_query: params.query ?? null,
    p_after: timeRange?.after.toISOString() ?? null,
    p_before: timeRange?.before.toISOString() ?? null,
    p_limit: DEFAULT_LIMIT,
  });

  if (error) {
    console.error("[retrieve-cooked-recipes] RPC error:", error.message);
    return [];
  }

  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const rows = data as CookedRecipeRow[];

  return rows.map((row) => ({
    recipeId: row.recipe_id,
    recipeTable: row.recipe_table === "user_recipes"
      ? "user_recipes"
      : "recipes",
    name: row.name?.trim() || "Untitled",
    imageUrl: row.image_url || undefined,
    totalTime: Math.max(0, Number(row.total_time ?? 0)),
    difficulty: normalizeDifficulty(row.difficulty),
    portions: Math.max(1, Number(row.portions ?? 1)),
  }));
}
