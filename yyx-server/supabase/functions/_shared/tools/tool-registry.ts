/**
 * Central tool registry used by text and voice paths.
 * New tools should be added here to keep wiring in one place.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { AITool, CostContext } from "../ai-gateway/types.ts";
import type { RecipeCard, UserContext } from "../irmixy-schemas.ts";
import {
  AIUsageLogContext,
  generateCustomRecipe,
  generateCustomRecipeTool,
  GenerateRecipeResult,
  PartialRecipeCallback,
} from "./generate-custom-recipe.ts";
import { modifyRecipe, modifyRecipeTool } from "./modify-recipe.ts";
import {
  retrieveCookedRecipes,
  retrieveCookedRecipesTool,
} from "./retrieve-cooked-recipes.ts";
import { searchRecipes, searchRecipesTool } from "./search-recipes.ts";
import {
  type AppActionResult,
  appActionTool,
  executeAppAction,
} from "./app-action.ts";

export interface ToolExecutionContext {
  supabase: SupabaseClient;
  userContext: UserContext;
  onPartialRecipe?: PartialRecipeCallback;
  usageContext?: AIUsageLogContext;
  costContext?: CostContext;
}

export interface ToolShape {
  recipes?: RecipeCard[];
  customRecipe?: GenerateRecipeResult["recipe"];
  safetyFlags?: GenerateRecipeResult["safetyFlags"];
  appActionResult?: AppActionResult;
  result?: unknown;
}

interface ToolRegistration {
  aiTool: AITool;
  allowedInVoice: boolean;
  execute: (args: unknown, context: ToolExecutionContext) => Promise<unknown>;
  shapeResult: (result: unknown) => ToolShape;
}

const TOOL_REGISTRY: Record<string, ToolRegistration> = {
  search_recipes: {
    aiTool: {
      name: searchRecipesTool.function.name,
      description: searchRecipesTool.function.description,
      parameters: searchRecipesTool.function.parameters as Record<
        string,
        unknown
      >,
    },
    allowedInVoice: true,
    execute: async (args, context) =>
      await searchRecipes(
        context.supabase,
        args,
        context.userContext,
      ),
    shapeResult: (result) =>
      Array.isArray(result) ? { recipes: result as RecipeCard[] } : { result },
  },
  generate_custom_recipe: {
    aiTool: {
      name: generateCustomRecipeTool.function.name,
      description: generateCustomRecipeTool.function.description,
      parameters: generateCustomRecipeTool.function.parameters as Record<
        string,
        unknown
      >,
    },
    allowedInVoice: true,
    execute: async (args, context) =>
      await generateCustomRecipe(
        context.supabase,
        args,
        context.userContext,
        context.onPartialRecipe,
        context.usageContext,
        context.costContext,
      ),
    shapeResult: (result) => {
      if (!result || typeof result !== "object") {
        return { result };
      }
      const generated = result as GenerateRecipeResult;
      return {
        customRecipe: generated.recipe,
        safetyFlags: generated.safetyFlags,
      };
    },
  },
  modify_recipe: {
    aiTool: {
      name: modifyRecipeTool.function.name,
      description: modifyRecipeTool.function.description,
      parameters: modifyRecipeTool.function.parameters as Record<
        string,
        unknown
      >,
    },
    allowedInVoice: true,
    execute: async (args, context) =>
      await modifyRecipe(
        context.supabase,
        args,
        context.userContext,
        context.onPartialRecipe,
        context.costContext,
      ),
    shapeResult: (result) => {
      if (!result || typeof result !== "object") {
        return { result };
      }
      const generated = result as GenerateRecipeResult;
      return {
        customRecipe: generated.recipe,
        safetyFlags: generated.safetyFlags,
      };
    },
  },
  app_action: {
    aiTool: {
      name: appActionTool.function.name,
      description: appActionTool.function.description,
      parameters: appActionTool.function.parameters as Record<
        string,
        unknown
      >,
    },
    allowedInVoice: true,
    execute: async (args) => executeAppAction(args),
    shapeResult: (result) => {
      if (result && typeof result === "object" && "action" in result) {
        return { appActionResult: result as AppActionResult };
      }
      return { result };
    },
  },
  retrieve_cooked_recipes: {
    aiTool: {
      name: retrieveCookedRecipesTool.function.name,
      description: retrieveCookedRecipesTool.function.description,
      parameters: retrieveCookedRecipesTool.function.parameters as Record<
        string,
        unknown
      >,
    },
    allowedInVoice: true,
    execute: async (args, context) =>
      await retrieveCookedRecipes(
        context.supabase,
        args,
        context.userContext,
      ),
    shapeResult: (result) =>
      Array.isArray(result) ? { recipes: result as RecipeCard[] } : { result },
  },
};

export function getToolRegistration(
  toolName: string,
): ToolRegistration | undefined {
  return TOOL_REGISTRY[toolName];
}

export function getRegisteredToolNames(): string[] {
  return Object.keys(TOOL_REGISTRY);
}

export function getRegisteredAiTools(exclude?: string[]): AITool[] {
  const entries = Object.entries(TOOL_REGISTRY);
  if (!exclude || exclude.length === 0) {
    return entries.map(([, tool]) => tool.aiTool);
  }
  return entries
    .filter(([name]) => !exclude.includes(name))
    .map(([, tool]) => tool.aiTool);
}

export function getAllowedVoiceToolNames(): string[] {
  return Object.entries(TOOL_REGISTRY)
    .filter(([, tool]) => tool.allowedInVoice)
    .map(([name]) => name);
}
