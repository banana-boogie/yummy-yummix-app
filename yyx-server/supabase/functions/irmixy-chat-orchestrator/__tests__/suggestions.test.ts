/**
 * Suggestion Builder Tests
 *
 * Verifies deterministic suggestion templates and no-results fallback messages.
 */

import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import {
  buildNoResultsFallback,
  getContextualSuggestions,
  getTemplateSuggestions,
} from "../suggestions.ts";

Deno.test("getTemplateSuggestions returns chat templates when no recipes are present", () => {
  const en = getTemplateSuggestions("en", false);
  const es = getTemplateSuggestions("es", false);

  assertEquals(en.length, 2);
  assertEquals(en[0].label, "Make me a recipe");
  assertEquals(en[0].label, en[0].message);
  assertEquals(en.some((chip) => chip.label === "Search recipes"), false);

  assertEquals(es.length, 2);
  assertEquals(es[0].label, "Hazme una receta");
  assertEquals(es[0].label, es[0].message);
});

Deno.test("getTemplateSuggestions returns post-search templates when recipes are present", () => {
  const en = getTemplateSuggestions("en", true);
  const es = getTemplateSuggestions("es", true);

  assertEquals(en.length, 2);
  assertEquals(en[0].label, "Show more options");
  assertEquals(en[1].label, "Search for different recipes");

  assertEquals(es.length, 2);
  assertEquals(es[0].label, "Ver más opciones");
  assertEquals(es[1].label, "Busca otras recetas");
});

Deno.test("getContextualSuggestions includes top recipe names and truncates labels", () => {
  const suggestions = getContextualSuggestions({
    language: "en",
    hasRecipes: true,
    recipeNames: [
      "Tinga Poblana de Pollo con Salsa Roja Tradicional",
      "Pasta Carbonara",
      "Ignored third recipe",
    ],
  });

  assertEquals(suggestions.length, 3);
  assertEquals(suggestions[0].label.endsWith("…"), true);
  assertEquals(
    suggestions[0].message,
    'I want the "Tinga Poblana de Pollo con Salsa Roja Tradicional" recipe',
  );
  assertEquals(suggestions[1].label, "Pasta Carbonara");
  assertEquals(suggestions[2].label, "Search for different recipes");
});

Deno.test("getContextualSuggestions returns empty suggestions after custom recipe generation", () => {
  const suggestions = getContextualSuggestions({
    language: "es",
    hasRecipes: false,
    hasCustomRecipe: true,
  });

  assertEquals(suggestions.length, 0);
});

Deno.test("buildNoResultsFallback returns deterministic localized fallback", () => {
  const en = buildNoResultsFallback("en");
  const es = buildNoResultsFallback("es");

  assertEquals(
    en.message,
    "I didn't find that recipe. Do you want me to search for something similar, or create a custom version?",
  );
  assertEquals(en.suggestions.length, 2);
  assertEquals(en.suggestions[0].label, "Search similar recipes");

  assertEquals(
    es.message,
    "No encontré esa receta. ¿Quieres que busque algo similar o que cree una versión personalizada?",
  );
  assertEquals(es.suggestions.length, 2);
  assertEquals(es.suggestions[0].label, "Buscar similares");
});
