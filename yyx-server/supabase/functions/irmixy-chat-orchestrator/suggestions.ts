/**
 * Suggestion Builder
 *
 * Builds contextual suggestion chips based on the AI's response and tool results.
 * Suggestions appear as tappable chips in the chat UI.
 */

import type { IrmixyResponse } from "../_shared/irmixy-schemas.ts";

type Suggestion = NonNullable<IrmixyResponse["suggestions"]>[number];

/**
 * Build suggestions based on the conversation context.
 *
 * Key rule: recipe generation is NEVER automatic — we show a suggestion chip
 * and let the user decide. This prevents the AI from silently calling
 * generate_custom_recipe on ambiguous requests.
 */
export function buildSuggestions(
  userMessage: string,
  aiResponse: string,
  hasRecipeResults: boolean,
  hasCustomRecipe: boolean,
  locale: string,
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // If a recipe was already generated or found, no need to suggest generation
  if (hasCustomRecipe || hasRecipeResults) return suggestions;

  // Detect if the AI's response hints at recipe creation (the AI was told not to
  // auto-generate, so it may mention creating/making a recipe in text instead)
  const recipeHintPatterns = [
    /(?:want|like|love)\s+(?:me\s+)?to\s+(?:create|make|generate|whip up|prepare)/i,
    /(?:shall|should)\s+I\s+(?:create|make|generate|whip up|prepare)/i,
    /(?:I\s+can|I'd\s+be\s+happy\s+to)\s+(?:create|make|generate|whip up|prepare)/i,
    /(?:quieres que|te gustar[ií]a que)\s+(?:cree|prepare|haga|genere)/i,
    /(?:puedo|podr[ií]a)\s+(?:crear|preparar|hacer|generar)/i,
  ];

  // Also detect if the user's message implies wanting a recipe
  const userWantsRecipe = [
    /(?:make|cook|create|prepare|bake|whip up)\s+(?:me\s+)?(?:a|an|some)/i,
    /(?:i\s+want|i'd\s+like|can\s+you\s+make)\s+/i,
    /(?:recipe\s+for|how\s+to\s+make)\s+/i,
    /(?:hazme|preparame|cocina|quiero\s+(?:hacer|cocinar|preparar))\s+/i,
    /(?:receta\s+(?:de|para))\s+/i,
  ];

  const aiHintsAtRecipe = recipeHintPatterns.some((p) => p.test(aiResponse));
  const userAskedForRecipe = userWantsRecipe.some((p) => p.test(userMessage));

  if (aiHintsAtRecipe || userAskedForRecipe) {
    // Extract what they want to make from the user message
    const recipeName = extractRecipeName(userMessage, locale);
    const isSpanish = locale.startsWith("es");

    suggestions.push({
      label: isSpanish
        ? `Crear receta de ${recipeName}`
        : `Create a ${recipeName} recipe`,
      message: isSpanish
        ? `Sí, genera una receta personalizada de ${recipeName}`
        : `Yes, please generate a custom ${recipeName} recipe for me`,
      type: "recipe_generation",
    });
  }

  return suggestions;
}

/**
 * Extract a recipe name/dish from the user's message.
 * Falls back to a generic term if we can't parse it.
 */
function extractRecipeName(message: string, locale: string): string {
  const isSpanish = locale.startsWith("es");

  // Try to extract "make me X", "cook X", "recipe for X", etc.
  const patterns = [
    /(?:make|cook|create|prepare|bake)\s+(?:me\s+)?(?:a\s+|an\s+|some\s+)?(.+?)(?:\s+recipe)?$/i,
    /(?:i\s+want|i'd\s+like)\s+(?:to\s+(?:make|cook|eat|try)\s+)?(?:a\s+|an\s+|some\s+)?(.+?)$/i,
    /recipe\s+for\s+(.+?)$/i,
    /(?:hazme|preparame|cocina)\s+(?:una?\s+)?(.+?)$/i,
    /(?:quiero\s+(?:hacer|cocinar|preparar|comer))\s+(?:una?\s+)?(.+?)$/i,
    /receta\s+(?:de|para)\s+(.+?)$/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1].trim().toLowerCase().replace(/[.!?,"]+$/, "");
    }
  }

  return isSpanish ? "este platillo" : "this dish";
}
