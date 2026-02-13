/**
 * Suggestion Builders
 *
 * Template-based suggestion chips and fallback responses.
 * Uses pre-defined templates to avoid AI call latency.
 */

import type { SuggestionChip } from "../_shared/irmixy-schemas.ts";

/**
 * Get template suggestions for chat responses.
 * Uses pre-defined templates to avoid a 2.9s AI call.
 */
export function getTemplateSuggestions(
  language: "en" | "es",
  hasRecipes: boolean,
): SuggestionChip[] {
  if (hasRecipes) {
    // Suggestions after search results
    return [
      {
        label: language === "es" ? "Ver más opciones" : "Show more options",
        message: language === "es" ? "Ver más opciones" : "Show more options",
      },
      {
        label: language === "es" ? "Crear receta" : "Create recipe",
        message: language === "es" ? "Crear receta" : "Create recipe",
      },
      {
        label: language === "es" ? "Algo diferente" : "Something different",
        message: language === "es" ? "Algo diferente" : "Something different",
      },
    ];
  }

  // General chat suggestions
  return [
    {
      label: language === "es" ? "Hazme una receta" : "Make me a recipe",
      message: language === "es" ? "Hazme una receta" : "Make me a recipe",
    },
    {
      label: language === "es" ? "Buscar recetas" : "Search recipes",
      message: language === "es" ? "Buscar recetas" : "Search recipes",
    },
    {
      label: language === "es" ? "¿Qué puedo cocinar?" : "What can I cook?",
      message: language === "es" ? "¿Qué puedo cocinar?" : "What can I cook?",
    },
  ];
}

/**
 * Build a deterministic no-results fallback response (no AI call).
 * Per irmixy-completion-plan.md Section 6.9
 */
export function buildNoResultsFallback(language: "en" | "es"): {
  message: string;
  suggestions: SuggestionChip[];
} {
  return {
    message: language === "es"
      ? "No encontré recetas que coincidan, ¡pero puedo crear algo personalizado!"
      : "I couldn't find recipes matching that, but I can create something custom!",
    suggestions: [
      {
        label: language === "es"
          ? "Crear desde ingredientes"
          : "Create from ingredients",
        message: language === "es"
          ? "Quiero crear una receta nueva con ingredientes"
          : "I want to create a new recipe from ingredients",
      },
      {
        label: language === "es" ? "Sorpréndeme" : "Surprise me",
        message: language === "es"
          ? "Hazme una receta sorpresa"
          : "Make me a surprise recipe",
      },
    ],
  };
}
