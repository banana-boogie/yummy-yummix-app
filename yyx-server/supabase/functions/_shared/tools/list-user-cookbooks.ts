/**
 * List User Cookbooks Tool
 *
 * Returns all cookbooks owned by the authenticated user.
 * Uses the Supabase client's auth context to determine user_id.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { UserContext } from "../irmixy-schemas.ts";
import { pickTranslation } from "../locale-utils.ts";
import { validateListUserCookbooksParams } from "./tool-validators.ts";

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
  validateListUserCookbooksParams(_args);

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
      cookbook_recipes(count)
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

  // Resolve translated names using shared pickTranslation
  return cookbooks.map((cookbook: any) => {
    const translations = (cookbook.translations ?? []) as Array<
      { locale: string; name: string }
    >;
    const t = pickTranslation(translations, userContext.localeChain);
    const name = t?.name ?? translations[0]?.name ?? "Untitled";

    // cookbook_recipes(count) returns [{ count: number }]
    const recipeCountResult = cookbook.cookbook_recipes as
      | [{ count: number }]
      | null;
    const recipeCount = recipeCountResult?.[0]?.count ?? 0;

    return {
      id: cookbook.id,
      name,
      recipeCount,
      isDefault: cookbook.is_default ?? false,
    };
  });
}
