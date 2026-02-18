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
