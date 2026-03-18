/**
 * Submit Recipe Rating Tool
 *
 * Allows Irmixy to submit a recipe rating on behalf of the user.
 * Looks up the recipe by name (fuzzy match), verifies the user has
 * completed the recipe, and upserts the rating. Optionally stores
 * text feedback.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  clampNumber,
  sanitizeString,
  ToolValidationError,
} from "./tool-validators.ts";

// ============================================================
// Types
// ============================================================

export interface SubmitRecipeRatingParams {
  recipe_name: string;
  rating: number;
  feedback?: string;
}

export interface SubmitRecipeRatingResult {
  success: boolean;
  recipe_name: string;
  rating: number;
  feedback_saved: boolean;
  message: string;
}

// ============================================================
// Tool Definition (OpenAI function calling schema)
// ============================================================

export const submitRecipeRatingTool = {
  function: {
    name: "submit_recipe_rating",
    description:
      "Submit a recipe rating (1-5 stars) on behalf of the user. Use this when the user expresses an opinion " +
      "about a recipe they have cooked. ALWAYS confirm with the user before calling this tool " +
      '(e.g., "Entiendo que te encanto, le pongo 5 estrellas?"). ' +
      "The user must have completed the recipe before they can rate it.",
    parameters: {
      type: "object",
      properties: {
        recipe_name: {
          type: "string",
          description:
            "The name of the recipe the user wants to rate. Extracted from the conversation context.",
        },
        rating: {
          type: "integer",
          description: "Star rating from 1 to 5. Infer from user sentiment: " +
            "riquísima/increíble/amazing = 5, muy buena/great = 4, estuvo bien/okay = 3, " +
            "no me gustó mucho/not great = 2, horrible/terrible = 1.",
        },
        feedback: {
          type: "string",
          description:
            "Optional text feedback from the user about the recipe. Include if the user provides specific comments.",
        },
      },
      required: ["recipe_name", "rating"],
    },
  },
};

// ============================================================
// Parameter Validation
// ============================================================

export function validateSubmitRecipeRatingParams(
  raw: unknown,
): SubmitRecipeRatingParams {
  let params: unknown;
  if (typeof raw === "string") {
    try {
      params = JSON.parse(raw);
    } catch {
      throw new ToolValidationError(
        "Invalid JSON in submit_recipe_rating params",
      );
    }
  } else {
    params = raw;
  }

  if (!params || typeof params !== "object") {
    throw new ToolValidationError(
      "submit_recipe_rating params must be an object",
    );
  }

  const p = params as Record<string, unknown>;

  // recipe_name is required
  if (typeof p.recipe_name !== "string" || !p.recipe_name.trim()) {
    throw new ToolValidationError(
      "submit_recipe_rating requires a non-empty recipe_name",
    );
  }
  const recipe_name = sanitizeString(p.recipe_name, 200);

  // rating is required, must be integer 1-5
  if (p.rating === undefined || p.rating === null) {
    throw new ToolValidationError(
      "submit_recipe_rating requires a rating (1-5)",
    );
  }
  const rating = clampNumber(p.rating, 1, 5);

  // feedback is optional
  const feedback = typeof p.feedback === "string" && p.feedback.trim()
    ? sanitizeString(p.feedback, 2000)
    : undefined;

  return { recipe_name, rating, feedback };
}

// ============================================================
// Execution
// ============================================================

/**
 * Execute the submit_recipe_rating tool.
 *
 * Steps:
 * 1. Validate parameters
 * 2. Search for recipe by name in recipe_translations (fuzzy ILIKE)
 * 3. Check user has completed the recipe (recipe_completions)
 * 4. Upsert into recipe_ratings
 * 5. Optionally insert feedback into recipe_feedback
 * 6. Return confirmation
 */
export async function submitRecipeRating(
  supabase: SupabaseClient,
  args: unknown,
  userLocale: string,
): Promise<SubmitRecipeRatingResult> {
  const params = validateSubmitRecipeRatingParams(args);

  // Derive the language from the locale for the translation search
  const language = userLocale.startsWith("es") ? "es" : "en";

  // 1. Find recipe by name (fuzzy match via ILIKE on recipe_translations)
  const { data: translationMatches, error: searchError } = await supabase
    .from("recipe_translations")
    .select("recipe_id, name, locale")
    .ilike("name", `%${params.recipe_name}%`)
    .eq("locale", language)
    .limit(1);

  if (searchError) {
    throw new Error(`Failed to search recipes: ${searchError.message}`);
  }

  // If no match in the user's language, try the other language as fallback
  let recipeId: string | null = null;
  let matchedName: string | null = null;

  if (translationMatches && translationMatches.length > 0) {
    recipeId = translationMatches[0].recipe_id;
    matchedName = translationMatches[0].name;
  } else {
    // Fallback: search across all locales
    const { data: fallbackMatches, error: fallbackError } = await supabase
      .from("recipe_translations")
      .select("recipe_id, name, locale")
      .ilike("name", `%${params.recipe_name}%`)
      .limit(1);

    if (fallbackError) {
      throw new Error(`Failed to search recipes: ${fallbackError.message}`);
    }

    if (fallbackMatches && fallbackMatches.length > 0) {
      recipeId = fallbackMatches[0].recipe_id;
      matchedName = fallbackMatches[0].name;
    }
  }

  if (!recipeId || !matchedName) {
    return {
      success: false,
      recipe_name: params.recipe_name,
      rating: params.rating,
      feedback_saved: false,
      message:
        `Could not find a recipe matching "${params.recipe_name}". Ask the user to clarify which recipe they mean.`,
    };
  }

  // 2. Check user has completed the recipe
  const { data: completions, error: completionError } = await supabase
    .from("recipe_completions")
    .select("id")
    .eq("recipe_id", recipeId)
    .limit(1);

  if (completionError) {
    throw new Error(`Failed to check completions: ${completionError.message}`);
  }

  if (!completions || completions.length === 0) {
    return {
      success: false,
      recipe_name: matchedName,
      rating: params.rating,
      feedback_saved: false,
      message:
        `The user has not completed "${matchedName}" yet. They need to cook the recipe before rating it.`,
    };
  }

  // 3. Get the authenticated user's ID
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("Could not identify authenticated user");
  }

  // 4. Upsert rating
  const { error: ratingError } = await supabase
    .from("recipe_ratings")
    .upsert(
      {
        user_id: user.id,
        recipe_id: recipeId,
        rating: params.rating,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,recipe_id" },
    );

  if (ratingError) {
    throw new Error(`Failed to save rating: ${ratingError.message}`);
  }

  // 5. Optionally insert feedback
  let feedbackSaved = false;
  if (params.feedback) {
    const { error: feedbackError } = await supabase
      .from("recipe_feedback")
      .insert({
        user_id: user.id,
        recipe_id: recipeId,
        feedback: params.feedback,
      });

    if (feedbackError) {
      // Log but don't fail the whole operation — rating was already saved
      console.error("Failed to save feedback:", feedbackError.message);
    } else {
      feedbackSaved = true;
    }
  }

  return {
    success: true,
    recipe_name: matchedName,
    rating: params.rating,
    feedback_saved: feedbackSaved,
    message: `Rating of ${params.rating} star${
      params.rating !== 1 ? "s" : ""
    } saved for "${matchedName}".${
      feedbackSaved ? " Feedback also saved." : ""
    }`,
  };
}
