/**
 * Suggestion Builders
 *
 * Template-based suggestion chips and fallback responses.
 * Uses pre-defined templates to avoid AI call latency.
 */

import type { SuggestionChip } from "../_shared/irmixy-schemas.ts";

const MAX_RECIPE_CHIP_LABEL = 30;

function getSearchDifferentChip(language: "en" | "es"): SuggestionChip {
  return language === "es"
    ? {
      label: "Busca otras recetas",
      message: "Busca otras recetas",
    }
    : {
      label: "Search for different recipes",
      message: "Search for different recipes",
    };
}

export interface SuggestionContext {
  language: "en" | "es";
  hasRecipes: boolean;
  recipeNames?: string[];
  hasCustomRecipe?: boolean;
}

function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Get contextual suggestions for chat responses.
 * Uses deterministic templates to avoid additional AI latency.
 */
export function getContextualSuggestions(
  context: SuggestionContext,
): SuggestionChip[] {
  const { language, hasRecipes, recipeNames, hasCustomRecipe } = context;

  if (hasCustomRecipe) {
    return [];
  }

  if (hasRecipes) {
    const topRecipeNames = (recipeNames || [])
      .filter((name): name is string =>
        typeof name === "string" && name.trim().length > 0
      )
      .slice(0, 2);

    if (topRecipeNames.length > 0) {
      const recipeChips = topRecipeNames.map((name) => {
        const trimmedName = name.trim();
        return {
          label: truncateLabel(trimmedName, MAX_RECIPE_CHIP_LABEL),
          message: language === "es"
            ? `Quiero la receta "${trimmedName}"`
            : `I want the "${trimmedName}" recipe`,
        };
      });

      recipeChips.push(getSearchDifferentChip(language));
      return recipeChips;
    }

    return [
      {
        label: language === "es" ? "Ver más opciones" : "Show more options",
        message: language === "es" ? "Ver más opciones" : "Show more options",
      },
      getSearchDifferentChip(language),
    ];
  }

  // General chat suggestions
  return [
    {
      label: language === "es" ? "Hazme una receta" : "Make me a recipe",
      message: language === "es" ? "Hazme una receta" : "Make me a recipe",
    },
    {
      label: language === "es" ? "¿Qué puedo cocinar?" : "What can I cook?",
      message: language === "es" ? "¿Qué puedo cocinar?" : "What can I cook?",
    },
  ];
}

/**
 * Backward-compatible wrapper around contextual suggestions.
 */
export function getTemplateSuggestions(
  language: "en" | "es",
  hasRecipes: boolean,
): SuggestionChip[] {
  return getContextualSuggestions({ language, hasRecipes });
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
