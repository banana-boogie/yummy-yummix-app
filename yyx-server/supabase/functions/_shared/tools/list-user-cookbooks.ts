/**
 * List User Cookbooks Tool
 *
 * Returns all cookbooks owned by the authenticated user.
 * Uses the Supabase client's auth context to determine user_id.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { UserContext } from "../irmixy-schemas.ts";

export interface CookbookListItem {
  id: string;
  name: string;
  recipeCount: number;
  isDefault: boolean;
}

/** AI tool definition for the LLM. */
export const listUserCookbooksTool = {
  function: {
    name: "list_user_cookbooks",
    description:
      'List all cookbooks belonging to the current user. Returns each cookbook with its name, recipe count, and whether it is the default (Favorites) cookbook. Use this when the user asks "what cookbooks do I have?" or wants to see their collections.',
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

/**
 * Execute the list_user_cookbooks tool.
 * Fetches all cookbooks for the authenticated user with translated names
 * and recipe counts.
 */
export async function listUserCookbooks(
  supabase: SupabaseClient,
  _args: unknown,
  userContext: UserContext,
): Promise<CookbookListItem[]> {
  // Get user from auth context
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Fetch cookbooks with translations and recipe count
  const { data: cookbooks, error } = await supabase
    .from("cookbooks")
    .select(
      `
      id,
      is_default,
      translations:cookbook_translations(locale, name),
      cookbook_recipes(id)
    `,
    )
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch cookbooks: ${error.message}`);
  }

  if (!cookbooks || cookbooks.length === 0) {
    return [];
  }

  // Resolve translated names using the user's locale chain
  return cookbooks.map((cookbook: any) => {
    const translations = cookbook.translations ?? [];
    // Pick best translation: walk locale chain, fall back to first available
    let name = "Untitled";
    for (const locale of userContext.localeChain) {
      const match = translations.find((t: any) => t.locale === locale);
      if (match?.name) {
        name = match.name;
        break;
      }
    }
    // If no chain match, use first available translation
    if (
      name === "Untitled" && translations.length > 0 && translations[0].name
    ) {
      name = translations[0].name;
    }

    return {
      id: cookbook.id,
      name,
      recipeCount: Array.isArray(cookbook.cookbook_recipes)
        ? cookbook.cookbook_recipes.length
        : 0,
      isDefault: cookbook.is_default ?? false,
    };
  });
}
