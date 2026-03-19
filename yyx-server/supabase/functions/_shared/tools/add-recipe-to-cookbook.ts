/**
 * Add Recipe to Cookbook Tool
 *
 * Adds a recipe to one of the user's cookbooks. Supports lookup by
 * cookbook name (fuzzy, case-insensitive) or cookbook ID.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { UserContext } from "../irmixy-schemas.ts";

export interface AddRecipeToCookbookResult {
  success: boolean;
  cookbookName: string;
  recipeName: string;
  alreadyInCookbook?: boolean;
}

export interface AddRecipeToCookbookAmbiguousResult {
  success: false;
  ambiguous: true;
  matches: Array<{ id: string; name: string }>;
  message: string;
}

export interface AddRecipeToCookbookNotFoundResult {
  success: false;
  notFound: true;
  suggestedAction: string;
  message: string;
}

export type AddRecipeToCookbookResponse =
  | AddRecipeToCookbookResult
  | AddRecipeToCookbookAmbiguousResult
  | AddRecipeToCookbookNotFoundResult;

/** AI tool definition for the LLM. */
export const addRecipeToCookbookTool = {
  function: {
    name: "add_recipe_to_cookbook",
    description:
      "Add a recipe to one of the user's cookbooks. You can specify the cookbook by name (fuzzy match) or by ID. " +
      "If the cookbook name is ambiguous (multiple matches), the tool returns the matches so you can ask the user. " +
      "If no cookbook matches, suggest creating one. Use this when the user says things like " +
      '"save that to my Weeknight Dinners" or "add this recipe to Favorites".',
    parameters: {
      type: "object",
      properties: {
        recipeId: {
          type: "string",
          description: "UUID of the recipe to add to the cookbook.",
        },
        cookbookName: {
          type: "string",
          description:
            "Name of the cookbook to add to (case-insensitive fuzzy match). Provide this OR cookbookId.",
        },
        cookbookId: {
          type: "string",
          description:
            "UUID of the cookbook to add to. If provided, takes precedence over cookbookName.",
        },
      },
      required: ["recipeId"],
    },
  },
};

/**
 * Execute the add_recipe_to_cookbook tool.
 */
export async function addRecipeToCookbook(
  supabase: SupabaseClient,
  args: unknown,
  userContext: UserContext,
): Promise<AddRecipeToCookbookResponse> {
  const params = args as Record<string, unknown>;
  const recipeId = params.recipeId as string;
  const cookbookName = params.cookbookName as string | undefined;
  const cookbookId = params.cookbookId as string | undefined;

  if (!recipeId) {
    throw new Error("recipeId is required");
  }

  // Get user from auth context
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Resolve the target cookbook
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
      throw new Error("Cookbook not found or not owned by user");
    }

    targetCookbookId = cookbook.id;
    targetCookbookName = resolveTranslatedName(
      (cookbook as any).translations,
      userContext.localeChain,
    );
  } else if (cookbookName) {
    // Fuzzy name match against user's cookbooks
    const { data: cookbooks, error } = await supabase
      .from("cookbooks")
      .select("id, translations:cookbook_translations(locale, name)")
      .eq("user_id", user.id);

    if (error) {
      throw new Error(`Failed to fetch cookbooks: ${error.message}`);
    }

    if (!cookbooks || cookbooks.length === 0) {
      return {
        success: false,
        notFound: true,
        suggestedAction: "create_cookbook",
        message:
          `No cookbooks found. Would the user like to create one called "${cookbookName}"?`,
      };
    }

    // Case-insensitive includes match
    const searchLower = cookbookName.toLowerCase();
    const matches = cookbooks.filter((cb: any) => {
      const translations = cb.translations ?? [];
      return translations.some(
        (t: any) => t.name && t.name.toLowerCase().includes(searchLower),
      );
    });

    if (matches.length === 0) {
      return {
        success: false,
        notFound: true,
        suggestedAction: "create_cookbook",
        message:
          `No cookbook matching "${cookbookName}" found. Suggest creating one.`,
      };
    }

    if (matches.length > 1) {
      return {
        success: false,
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
    // No cookbook specified — use default (Favorites)
    const { data: defaultCookbook, error } = await supabase
      .from("cookbooks")
      .select("id, translations:cookbook_translations(locale, name)")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .single();

    if (error || !defaultCookbook) {
      throw new Error(
        "No default cookbook found. User may need to create one.",
      );
    }

    targetCookbookId = defaultCookbook.id;
    targetCookbookName = resolveTranslatedName(
      (defaultCookbook as any).translations,
      userContext.localeChain,
    );
  }

  // Get recipe name for the response
  const recipeName = await getRecipeName(
    supabase,
    recipeId,
    userContext.localeChain,
  );

  // Check if already in cookbook
  const { data: existing } = await supabase
    .from("cookbook_recipes")
    .select("id")
    .eq("cookbook_id", targetCookbookId)
    .eq("recipe_id", recipeId)
    .maybeSingle();

  if (existing) {
    return {
      success: true,
      cookbookName: targetCookbookName,
      recipeName,
      alreadyInCookbook: true,
    };
  }

  // Get next display order atomically
  const { data: nextOrder } = await supabase.rpc("next_cookbook_recipe_order", {
    p_cookbook_id: targetCookbookId,
  });

  // Insert the cookbook recipe
  const { error: insertError } = await supabase.from("cookbook_recipes").insert(
    {
      cookbook_id: targetCookbookId,
      recipe_id: recipeId,
      display_order: nextOrder ?? 0,
    },
  );

  if (insertError) {
    // Handle unique constraint violation gracefully
    if (insertError.code === "23505") {
      return {
        success: true,
        cookbookName: targetCookbookName,
        recipeName,
        alreadyInCookbook: true,
      };
    }
    throw new Error(`Failed to add recipe to cookbook: ${insertError.message}`);
  }

  return {
    success: true,
    cookbookName: targetCookbookName,
    recipeName,
  };
}

/**
 * Resolve a translated name from a translations array using the locale chain.
 */
function resolveTranslatedName(
  translations: Array<{ locale: string; name: string }> | undefined,
  localeChain: string[],
): string {
  if (!translations || translations.length === 0) return "Untitled";

  for (const locale of localeChain) {
    const match = translations.find((t) => t.locale === locale);
    if (match?.name) return match.name;
  }

  // Fallback to first available
  return translations[0]?.name ?? "Untitled";
}

/**
 * Get recipe name in the user's locale.
 * Tries recipe_translations first (published recipes), then user_recipes.
 */
async function getRecipeName(
  supabase: SupabaseClient,
  recipeId: string,
  localeChain: string[],
): Promise<string> {
  // Try published recipes first
  const { data: translations } = await supabase
    .from("recipe_translations")
    .select("locale, name")
    .eq("recipe_id", recipeId);

  if (translations && translations.length > 0) {
    for (const locale of localeChain) {
      const match = translations.find((t: any) => t.locale === locale);
      if (match?.name) return match.name;
    }
    return translations[0]?.name ?? "Recipe";
  }

  // Try user recipes
  const { data: userRecipe } = await supabase
    .from("user_recipes")
    .select("name")
    .eq("id", recipeId)
    .maybeSingle();

  return userRecipe?.name ?? "Recipe";
}
