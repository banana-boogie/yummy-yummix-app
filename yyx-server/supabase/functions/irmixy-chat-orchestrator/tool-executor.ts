/**
 * Tool Executor
 *
 * Executes tool calls from the assistant message, collects results,
 * and shapes them for downstream consumption.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { RecipeCard, UserContext } from "../_shared/irmixy-schemas.ts";
import type {
  AIUsageLogContext,
  GenerateRecipeResult,
  PartialRecipeCallback,
} from "../_shared/tools/generate-custom-recipe.ts";
import { ToolValidationError } from "../_shared/tools/tool-validators.ts";
import { executeTool } from "../_shared/tools/execute-tool.ts";
import { shapeToolResponse } from "../_shared/tools/shape-tool-response.ts";
import type { CostContext } from "../_shared/ai-gateway/types.ts";
import type { ChatMessage, ToolCall, ToolExecutionResult } from "./types.ts";
import type { Logger } from "./logger.ts";

/**
 * Execute tool calls from the assistant message.
 * Returns tool response messages and any recipe results.
 *
 * @param onPartialRecipe - Optional callback for two-phase SSE. If provided,
 *   called with the recipe immediately after LLM generation (before enrichment).
 */
export async function executeToolCalls(
  supabase: SupabaseClient,
  toolCalls: ToolCall[],
  userContext: UserContext,
  log: Logger,
  usageContext: AIUsageLogContext,
  onPartialRecipe?: PartialRecipeCallback,
  costContext?: CostContext,
): Promise<ToolExecutionResult> {
  const toolMessages: ChatMessage[] = [];
  let recipes: RecipeCard[] | undefined;
  let recipesSourceTool: string | undefined;
  let customRecipeResult: GenerateRecipeResult | undefined;
  let appActionResult:
    | import("../_shared/tools/app-action.ts").AppActionResult
    | undefined;

  const results = await Promise.all(
    toolCalls.map(async (toolCall) => {
      const { name, arguments: args } = toolCall.function;
      try {
        const result = await executeTool(
          supabase,
          name,
          args,
          userContext,
          {
            onPartialRecipe,
            usageContext,
            costContext,
          },
        );

        return {
          toolMessage: {
            role: "tool" as const,
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
          },
          toolName: name,
          shaped: shapeToolResponse(name, result),
        };
      } catch (toolError) {
        log.error(`Tool ${name} error`, toolError);
        const errorMsg = toolError instanceof ToolValidationError
          ? `Invalid parameters: ${toolError.message}`
          : "Tool execution failed";

        return {
          toolMessage: {
            role: "tool" as const,
            content: JSON.stringify({ error: errorMsg }),
            tool_call_id: toolCall.id,
          },
          toolName: name,
          shaped: undefined,
        };
      }
    }),
  );

  for (const execution of results) {
    toolMessages.push(execution.toolMessage);
    if (!execution.shaped) continue;

    if (execution.shaped.recipes) {
      recipes = execution.shaped.recipes;
      recipesSourceTool = execution.toolName;
    } else if (execution.shaped.customRecipe) {
      customRecipeResult = {
        recipe: execution.shaped.customRecipe,
        safetyFlags: execution.shaped.safetyFlags,
      };
    }
    if (execution.shaped.appActionResult) {
      appActionResult = execution.shaped.appActionResult;
    }
  }

  return {
    toolMessages,
    recipes,
    recipesSourceTool,
    customRecipeResult,
    appActionResult,
  };
}
