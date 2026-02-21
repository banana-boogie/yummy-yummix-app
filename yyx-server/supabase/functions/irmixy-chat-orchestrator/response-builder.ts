/**
 * Response Builders
 *
 * Functions for building final IrmixyResponse objects and error responses.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type {
  IrmixyResponse,
  QuickAction,
  RecipeCard,
  UserContext,
} from "../_shared/irmixy-schemas.ts";
import {
  IrmixyResponseSchema,
  validateSchema,
} from "../_shared/irmixy-schemas.ts";
import type { GenerateRecipeResult } from "../_shared/tools/generate-custom-recipe.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { saveMessageToHistory } from "./history.ts";

/**
 * Build final IrmixyResponse, validate, and save to history.
 */
export async function finalizeResponse(
  supabase: SupabaseClient,
  sessionId: string | undefined,
  message: string,
  finalText: string,
  userContext: UserContext,
  recipes: RecipeCard[] | undefined,
  customRecipeResult: GenerateRecipeResult | undefined,
  actions?: QuickAction[],
): Promise<IrmixyResponse> {
  const irmixyResponse: IrmixyResponse = {
    version: "1.0",
    message: finalText,
    language: userContext.language,
    status: null,
    recipes,
    customRecipe: customRecipeResult?.recipe,
    isAIGenerated: customRecipeResult?.recipe ? true : undefined,
    safetyFlags: customRecipeResult?.safetyFlags,
    actions: actions && actions.length > 0 ? actions : undefined,
  };

  validateSchema(IrmixyResponseSchema, irmixyResponse);
  if (sessionId) {
    await saveMessageToHistory(
      supabase,
      sessionId,
      message,
      irmixyResponse,
    );
  }

  return irmixyResponse;
}

/**
 * Create a standardized error response.
 */
export function errorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
