/**
 * Response Builders
 *
 * Functions for building final IrmixyResponse objects and error responses.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type {
  Action,
  IrmixyResponse,
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
import type { PlanContext } from "./plan-context.ts";

/** Response category used to pick hard-coded follow-up chips. */
export type ResponseCategory = "recipe" | "planner" | "general";

export interface SuggestionChip {
  label: string;
  message: string;
  type?: "recipe_generation" | "default";
  metadata?: Record<string, unknown>;
}

/**
 * Hard-coded follow-up chips by response type + user language.
 *
 * Chips are intentionally NOT LLM-generated: inconsistent chip wording
 * destroys affordance. Each response category has 2-3 short, predictable
 * follow-ups in EN and ES so the user sees the same chips every time.
 */
export function buildSuggestions(
  category: ResponseCategory,
  language: "en" | "es",
  planContext?: PlanContext | null,
): SuggestionChip[] {
  const isEs = language === "es";
  const hasPlan = !!planContext;

  switch (category) {
    case "recipe":
      // NOTE: "Add to my plan" chip is intentionally omitted until a planner
      // mutation tool exists. See PR #45 review — chip would dead-end (system
      // prompt forbids plan edits, no tool is registered). Prefer fewer live
      // chips over dead-ends.
      return [
        {
          label: isEs ? "Algo diferente" : "Something different",
          message: isEs
            ? "Muéstrame algo diferente"
            : "Show me something different",
        },
        {
          label: isEs ? "Más rápido" : "Something quicker",
          message: isEs ? "Quiero algo más rápido" : "I want something quicker",
        },
      ];
    case "planner":
      if (hasPlan) {
        return [
          {
            label: isEs
              ? "¿Qué cocino esta noche?"
              : "What should I cook tonight?",
            message: isEs
              ? "¿Qué debería cocinar esta noche?"
              : "What should I cook tonight?",
          },
          {
            label: isEs ? "Ver mi menú" : "See my menu",
            message: isEs ? "¿Qué hay en mi menú?" : "What's on my menu?",
          },
        ];
      }
      return [
        {
          label: isEs ? "Empezar mi menú" : "Start my menu",
          message: isEs ? "Ayúdame a empezar mi menú" : "Help me start my menu",
        },
        {
          label: isEs
            ? "¿Qué cocino esta noche?"
            : "What should I cook tonight?",
          message: isEs
            ? "¿Qué debería cocinar esta noche?"
            : "What should I cook tonight?",
        },
      ];
    case "general":
    default:
      if (hasPlan) {
        return [
          {
            label: isEs
              ? "¿Qué cocino esta noche?"
              : "What should I cook tonight?",
            message: isEs
              ? "¿Qué debería cocinar esta noche?"
              : "What should I cook tonight?",
          },
          {
            label: isEs ? "Ver mi menú" : "See my menu",
            message: isEs ? "¿Qué hay en mi menú?" : "What's on my menu?",
          },
        ];
      }
      return [
        {
          label: isEs
            ? "¿Qué cocino esta noche?"
            : "What should I cook tonight?",
          message: isEs
            ? "¿Qué debería cocinar esta noche?"
            : "What should I cook tonight?",
        },
        {
          label: isEs ? "Empezar mi menú" : "Start my menu",
          message: isEs ? "Ayúdame a empezar mi menú" : "Help me start my menu",
        },
      ];
  }
}

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
  actions?: Action[],
  suggestions?: Array<{
    label: string;
    message: string;
    type?: "recipe_generation" | "default";
    metadata?: Record<string, unknown>;
  }>,
  options?: { skipUserMessage?: boolean },
): Promise<IrmixyResponse> {
  const irmixyResponse: IrmixyResponse = {
    version: "1.0",
    message: finalText,
    locale: userContext.locale,
    status: null,
    recipes,
    customRecipe: customRecipeResult?.recipe,
    isAIGenerated: customRecipeResult?.recipe ? true : undefined,
    safetyFlags: customRecipeResult?.safetyFlags,
    actions: actions && actions.length > 0 ? actions : undefined,
    suggestions: suggestions && suggestions.length > 0
      ? suggestions
      : undefined,
  };

  validateSchema(IrmixyResponseSchema, irmixyResponse);
  if (sessionId) {
    await saveMessageToHistory(
      supabase,
      sessionId,
      message,
      irmixyResponse,
      options?.skipUserMessage ? { skipUserMessage: true } : undefined,
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
