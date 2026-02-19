/**
 * Fallback Responses
 *
 * Deterministic no-results fallback for search.
 */

import type { SuggestionChip } from "../_shared/irmixy-schemas.ts";

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
      ? "No encontré esa receta. ¿Quieres que busque algo similar o que cree una versión personalizada?"
      : "I didn't find that recipe. Do you want me to search for something similar, or create a custom version?",
    suggestions: [
      {
        label: language === "es"
          ? "Buscar similares"
          : "Search similar recipes",
        message: language === "es"
          ? "Busca recetas similares"
          : "Search for similar recipes",
      },
      {
        label: language === "es"
          ? "Crear versión personalizada"
          : "Create custom version",
        message: language === "es"
          ? "Crea una versión personalizada"
          : "Create a custom version",
      },
    ],
  };
}

/**
 * Build deterministic fallback when cooked-history retrieval returns no matches.
 */
export function buildCookedHistoryFallback(language: "en" | "es"): {
  message: string;
  suggestions: SuggestionChip[];
} {
  return {
    message: language === "es"
      ? "No encontré recetas que hayas cocinado recientemente. ¿Quieres buscar recetas o crear una nueva con Irmixy?"
      : "I couldn't find recipes you've cooked recently. Want to search recipes, or create a new one with Irmixy?",
    suggestions: [
      {
        label: language === "es" ? "Buscar recetas" : "Search recipes",
        message: language === "es"
          ? "Busca recetas para cocinar"
          : "Search recipes to cook",
      },
      {
        label: language === "es" ? "Crear con Irmixy" : "Create with Irmixy",
        message: language === "es"
          ? "Crea una receta nueva con Irmixy"
          : "Create a new recipe with Irmixy",
      },
    ],
  };
}
