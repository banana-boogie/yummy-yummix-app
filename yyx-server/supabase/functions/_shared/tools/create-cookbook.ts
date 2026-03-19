/**
 * Create Cookbook Tool
 *
 * Creates a new cookbook for the authenticated user with a translation
 * row in the user's locale.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { UserContext } from "../irmixy-schemas.ts";

export interface CreateCookbookResult {
  id: string;
  name: string;
}

/** AI tool definition for the LLM. */
export const createCookbookTool = {
  function: {
    name: "create_cookbook",
    description:
      'Create a new cookbook for the user. Use this when the user says "create a cookbook called Holiday Baking" ' +
      "or when adding a recipe to a non-existent cookbook and the user confirms they want to create it.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name for the new cookbook.",
        },
        description: {
          type: "string",
          description: "Optional description for the cookbook.",
        },
      },
      required: ["name"],
    },
  },
};

/**
 * Execute the create_cookbook tool.
 */
export async function createCookbook(
  supabase: SupabaseClient,
  args: unknown,
  userContext: UserContext,
): Promise<CreateCookbookResult> {
  const params = args as Record<string, unknown>;
  const name = params.name as string;
  const description = params.description as string | undefined;

  if (!name || typeof name !== "string" || !name.trim()) {
    throw new Error("Cookbook name is required");
  }

  const trimmedName = name.trim().slice(0, 100);
  const trimmedDescription = description?.trim().slice(0, 500);

  // Get user from auth context
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Create the cookbook
  const { data: cookbook, error: cookbookError } = await supabase
    .from("cookbooks")
    .insert({
      user_id: user.id,
      is_default: false,
      is_public: false,
    })
    .select("id")
    .single();

  if (cookbookError || !cookbook) {
    throw new Error(
      `Failed to create cookbook: ${cookbookError?.message ?? "Unknown error"}`,
    );
  }

  // Determine locale for the translation row
  // Use the base language from the user's locale (e.g., "es" from "es-MX")
  const locale = userContext.language; // "en" or "es"

  // Insert translation
  const { error: translationError } = await supabase.from(
    "cookbook_translations",
  ).insert({
    cookbook_id: cookbook.id,
    locale,
    name: trimmedName,
    description: trimmedDescription ?? null,
  });

  if (translationError) {
    // Clean up the cookbook if translation insert fails
    await supabase.from("cookbooks").delete().eq("id", cookbook.id);
    throw new Error(
      `Failed to create cookbook translation: ${translationError.message}`,
    );
  }

  return {
    id: cookbook.id,
    name: trimmedName,
  };
}
