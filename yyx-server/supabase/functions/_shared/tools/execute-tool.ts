/**
 * Shared Tool Executor
 *
 * Dispatches tool calls to the appropriate handler.
 * Used by ai-orchestrator (text chat) and voice-tool-execute (voice chat).
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { UserContext } from "../irmixy-schemas.ts";
import { searchRecipes } from "./search-recipes.ts";
import { generateCustomRecipe } from "./generate-custom-recipe.ts";
import { ToolValidationError } from "./tool-validators.ts";

/**
 * Execute a single tool call with validation.
 *
 * @param supabase - Supabase client with user's auth context
 * @param name - Tool name (e.g., "search_recipes", "generate_custom_recipe")
 * @param args - JSON string of tool arguments
 * @param userContext - User preferences and dietary info
 * @param openaiApiKey - OpenAI API key for recipe generation
 * @returns Tool result (RecipeCard[] or GenerateRecipeResult)
 */
export async function executeTool(
  supabase: SupabaseClient,
  name: string,
  args: string,
  userContext: UserContext,
  openaiApiKey: string,
): Promise<unknown> {
  let parsedArgs: unknown;
  try {
    parsedArgs = JSON.parse(args);
  } catch {
    throw new ToolValidationError("Invalid JSON in tool arguments");
  }

  switch (name) {
    case "search_recipes":
      return await searchRecipes(supabase, parsedArgs, userContext);

    case "generate_custom_recipe":
      return await generateCustomRecipe(
        supabase,
        parsedArgs,
        userContext,
        openaiApiKey,
      );

    default:
      throw new ToolValidationError(`Unknown tool: ${name}`);
  }
}
