/**
 * Fixed Messages
 *
 * Deterministic messages for tool-result responses. These replace the second AI
 * streaming call to eliminate narration and latency.
 */

/** Message when search/retrieval found recipe results. */
export function buildSearchResultsMessage(language: "en" | "es"): string {
  return language === "es"
    ? "¡Mira lo que encontré! Te van a encantar."
    : "Ooh, I found a few you're going to love!";
}

/** Message when cooked-history retrieval found results. */
export function buildCookedHistoryMessage(language: "en" | "es"): string {
  return language === "es"
    ? "¡Mira lo que has cocinado!"
    : "Here's what you've been cooking!";
}

/** Message when search returned no results. */
export function buildNoResultsMessage(language: "en" | "es"): string {
  return language === "es"
    ? "No encontré esa receta, pero te puedo preparar algo parecido. ¿Quieres que cree una versión personalizada?"
    : "I didn't find that one, but I can make you something similar! Want me to create a custom version?";
}

/** Message when cooked-history returned no results. */
export function buildCookedHistoryEmptyMessage(language: "en" | "es"): string {
  return language === "es"
    ? "Aún no tienes recetas cocinadas. ¿Quieres buscar algo o crear una receta nueva?"
    : "You haven't cooked any recipes yet. Want to search for something, or create a new one?";
}

/** Fixed message for custom recipe generation success. */
export function buildCustomRecipeMessage(language: "en" | "es"): string {
  return language === "es"
    ? "¡Listo! ¿Quieres cambiar algo?"
    : "Ready! Want to change anything?";
}
