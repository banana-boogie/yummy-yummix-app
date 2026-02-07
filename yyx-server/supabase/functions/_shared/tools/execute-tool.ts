/**
 * Shared Tool Executor
 *
 * Dispatches tool calls to the appropriate handler.
 * Used by irmixy-chat-orchestrator (text chat) and irmixy-voice-orchestrator (voice chat).
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { UserContext } from "../irmixy-schemas.ts";
import { PartialRecipeCallback } from "./generate-custom-recipe.ts";
import { getToolRegistration } from "./tool-registry.ts";
import { ToolValidationError } from "./tool-validators.ts";

/**
 * Execute a single tool call with validation.
 *
 * @param supabase - Supabase client with user's auth context
 * @param name - Tool name (e.g., "search_recipes", "generate_custom_recipe")
 * @param args - JSON string of tool arguments
 * @param userContext - User preferences and dietary info
 * @param openaiApiKey - OpenAI API key for recipe generation
 * @param onPartialRecipe - Optional callback for two-phase SSE (recipe generation only)
 * @returns Tool result (RecipeCard[] or GenerateRecipeResult)
 */
export async function executeTool(
  supabase: SupabaseClient,
  name: string,
  args: string,
  userContext: UserContext,
  openaiApiKey: string,
  onPartialRecipe?: PartialRecipeCallback,
): Promise<unknown> {
  let parsedArgs: unknown;
  try {
    parsedArgs = JSON.parse(args);
  } catch {
    throw new ToolValidationError("Invalid JSON in tool arguments");
  }

  const tool = getToolRegistration(name);
  if (!tool) {
    throw new ToolValidationError(`Unknown tool: ${name}`);
  }

  return await tool.execute(parsedArgs, {
    supabase,
    userContext,
    openaiApiKey,
    onPartialRecipe,
  });
}
