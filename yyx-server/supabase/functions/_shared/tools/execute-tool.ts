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
 * @param executionOptions - Optional callback/flags for tool execution
 * @returns Tool result (RecipeCard[] or GenerateRecipeResult)
 */
export async function executeTool(
  supabase: SupabaseClient,
  name: string,
  args: string,
  userContext: UserContext,
  executionOptions?: {
    onPartialRecipe?: PartialRecipeCallback;
    bypassAllergenBlock?: boolean;
  },
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
    onPartialRecipe: executionOptions?.onPartialRecipe,
    bypassAllergenBlock: executionOptions?.bypassAllergenBlock,
  });
}
