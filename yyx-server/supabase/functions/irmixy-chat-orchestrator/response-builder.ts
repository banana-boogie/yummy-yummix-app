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
  SuggestionChip,
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
  suggestions?: SuggestionChip[],
  actions?: QuickAction[],
): Promise<IrmixyResponse> {
  // When a custom recipe is generated, use a fixed short message
  // This ensures consistent, brief responses regardless of AI output
  let responseMessage = finalText;
  if (customRecipeResult?.recipe) {
    responseMessage = userContext.language === "es"
      ? "¡Listo! ¿Quieres cambiar algo?"
      : "Ready! Want to change anything?";
  }

  const irmixyResponse: IrmixyResponse = {
    version: "1.0",
    message: responseMessage,
    language: userContext.language,
    status: null,
    recipes,
    customRecipe: customRecipeResult?.recipe,
    isAIGenerated: customRecipeResult?.recipe ? true : undefined,
    safetyFlags: customRecipeResult?.safetyFlags,
    suggestions,
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
