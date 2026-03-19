/**
 * Get Cookbook Recipes Tool
 *
 * Fetches recipes from a specific cookbook, identified by name or ID.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { UserContext } from "../irmixy-schemas.ts";
import { pickTranslation } from "../locale-utils.ts";
import { validateGetCookbookRecipesParams } from "./tool-validators.ts";

export interface CookbookRecipeItem {
  id: string;
  name: string;
  difficulty: string;
  totalTime: number;
  portions: number;
  imageUrl?: string;
}

export interface GetCookbookRecipesResult {
  cookbookName: string;
  cookbookId: string;
  recipes: CookbookRecipeItem[];
  totalCount: number;
}

export interface GetCookbookRecipesNotFoundResult {
  notFound: true;
  message: string;
}

export interface GetCookbookRecipesAmbiguousResult {
  ambiguous: true;
  matches: Array<{ id: string; name: string }>;
  message: string;
}

export type GetCookbookRecipesResponse =
  | GetCookbookRecipesResult
  | GetCookbookRecipesNotFoundResult
  | GetCookbookRecipesAmbiguousResult;

/** AI tool definition for the LLM. */
export const getCookbookRecipesTool = {
  function: {
    name: "get_cookbook_recipes",
    description:
      "Get the list of recipes in one of the user's cookbooks. Specify the cookbook by name (fuzzy match) or ID. " +
      'Use this when the user asks "what\'s in my Favorites?" or "show me my Weeknight Dinners recipes".',
    parameters: {
      type: "object",
      properties: {
        cookbookName: {
          type: "string",
          description:
            "Name of the cookbook (case-insensitive fuzzy match). Provide this OR cookbookId.",
        },
        cookbookId: {
          type: "string",
          description:
            "UUID of the cookbook. If provided, takes precedence over cookbookName.",
        },
      },
      required: [],
    },
  },
};

/**
 * Execute the get_cookbook_recipes tool.
 */
export async function getCookbookRecipes(
  supabase: SupabaseClient,
  args: unknown,
  userContext: UserContext,
): Promise<GetCookbookRecipesResponse> {
  const params = validateGetCookbookRecipesParams(args);
  const { cookbookName, cookbookId } = params;

  // Get user from auth context
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  let targetCookbookId: string;
  let targetCookbookName: string;

  if (cookbookId) {
    // Direct ID lookup
    const { data: cookbook, error } = await supabase
      .from("cookbooks")
      .select("id, translations:cookbook_translations(locale, name)")
      .eq("id", cookbookId)
      .eq("user_id", user.id)
      .single();

    if (error || !cookbook) {
      return {
        notFound: true,
        message: "Cookbook not found or not owned by user.",
      };
    }

    targetCookbookId = cookbook.id;
    targetCookbookName = resolveTranslatedName(
      (cookbook as any).translations,
      userContext.localeChain,
    );
  } else if (cookbookName) {
    // Fuzzy name match
    const { data: cookbooks, error } = await supabase
      .from("cookbooks")
      .select("id, translations:cookbook_translations(locale, name)")
      .eq("user_id", user.id);

    if (error || !cookbooks || cookbooks.length === 0) {
      return {
        notFound: true,
        message: "No cookbooks found for this user.",
      };
    }

    const searchLower = cookbookName.toLowerCase();
    const matches = cookbooks.filter((cb: any) => {
      const translations = cb.translations ?? [];
      return translations.some(
        (t: any) => t.name && t.name.toLowerCase().includes(searchLower),
      );
    });

    if (matches.length === 0) {
      return {
        notFound: true,
        message: `No cookbook matching "${cookbookName}" found.`,
      };
    }

    if (matches.length > 1) {
      return {
        ambiguous: true,
        matches: matches.map((cb: any) => ({
          id: cb.id,
          name: resolveTranslatedName(cb.translations, userContext.localeChain),
        })),
        message:
          `Multiple cookbooks match "${cookbookName}". Ask the user which one.`,
      };
    }

    targetCookbookId = matches[0].id;
    targetCookbookName = resolveTranslatedName(
      (matches[0] as any).translations,
      userContext.localeChain,
    );
  } else {
    // No name or ID — use default cookbook
    const { data: defaultCookbook, error } = await supabase
      .from("cookbooks")
      .select("id, translations:cookbook_translations(locale, name)")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .single();

    if (error || !defaultCookbook) {
      return {
        notFound: true,
        message: "No default cookbook found.",
      };
    }

    targetCookbookId = defaultCookbook.id;
    targetCookbookName = resolveTranslatedName(
      (defaultCookbook as any).translations,
      userContext.localeChain,
    );
  }

  // Fetch recipes in the cookbook
  const { data: cookbookRecipes, error: recipesError } = await supabase
    .from("cookbook_recipes")
    .select(
      `
      recipe_id,
      display_order,
      recipe:recipes(
        id,
        image_url,
        prep_time_minutes,
        cook_time_minutes,
        servings,
        difficulty,
        translations:recipe_translations(locale, name)
      )
    `,
    )
    .eq("cookbook_id", targetCookbookId)
    .order("display_order", { ascending: true });

  if (recipesError) {
    throw new Error(
      `Failed to fetch cookbook recipes: ${recipesError.message}`,
    );
  }

  const recipes: CookbookRecipeItem[] = (cookbookRecipes ?? [])
    .filter((cr: any) => cr.recipe)
    .map((cr: any) => {
      const r = cr.recipe;
      const name = resolveTranslatedName(
        r.translations,
        userContext.localeChain,
      );

      const totalTime = (r.prep_time_minutes ?? 0) + (r.cook_time_minutes ?? 0);

      return {
        id: r.id,
        name,
        difficulty: r.difficulty ?? "easy",
        totalTime,
        portions: r.servings ?? 1,
        imageUrl: r.image_url ?? undefined,
      };
    });

  return {
    cookbookName: targetCookbookName,
    cookbookId: targetCookbookId,
    recipes,
    totalCount: recipes.length,
  };
}

/** Resolve translated name using shared pickTranslation, with "Untitled" fallback. */
function resolveTranslatedName(
  translations: Array<{ locale: string; name: string }> | undefined,
  localeChain: string[],
): string {
  const t = pickTranslation(translations ?? [], localeChain);
  return t?.name ?? translations?.[0]?.name ?? "Untitled";
}
