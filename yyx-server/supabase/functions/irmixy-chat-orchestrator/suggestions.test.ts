/**
 * Suggestion Builder Tests
 *
 * Verifies deterministic suggestion templates and no-results fallback messages.
 */

import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import {
  buildNoResultsFallback,
  getTemplateSuggestions,
} from "./suggestions.ts";

Deno.test("getTemplateSuggestions returns chat templates when no recipes are present", () => {
  const en = getTemplateSuggestions("en", false);
  const es = getTemplateSuggestions("es", false);

  assertEquals(en.length, 3);
  assertEquals(en[0].label, "Make me a recipe");
  assertEquals(en[0].label, en[0].message);

  assertEquals(es.length, 3);
  assertEquals(es[0].label, "Hazme una receta");
  assertEquals(es[0].label, es[0].message);
});

Deno.test("getTemplateSuggestions returns post-search templates when recipes are present", () => {
  const en = getTemplateSuggestions("en", true);
  const es = getTemplateSuggestions("es", true);

  assertEquals(en.length, 3);
  assertEquals(en[0].label, "Show more options");
  assertEquals(en[1].label, "Create recipe");

  assertEquals(es.length, 3);
  assertEquals(es[0].label, "Ver más opciones");
  assertEquals(es[1].label, "Crear receta");
});

Deno.test("buildNoResultsFallback returns deterministic localized fallback", () => {
  const en = buildNoResultsFallback("en");
  const es = buildNoResultsFallback("es");

  assertEquals(
    en.message,
    "I couldn't find recipes matching that, but I can create something custom!",
  );
  assertEquals(en.suggestions.length, 2);
  assertEquals(en.suggestions[0].label, "Create from ingredients");

  assertEquals(
    es.message,
    "No encontré recetas que coincidan, ¡pero puedo crear algo personalizado!",
  );
  assertEquals(es.suggestions.length, 2);
  assertEquals(es.suggestions[0].label, "Crear desde ingredientes");
});
