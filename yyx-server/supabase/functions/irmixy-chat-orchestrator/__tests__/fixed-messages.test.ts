/**
 * Fixed Messages Tests
 *
 * Verifies deterministic message functions for tool-result responses.
 */

import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import {
  buildCookedHistoryEmptyMessage,
  buildCookedHistoryMessage,
  buildCustomRecipeMessage,
  buildNoResultsMessage,
  buildSearchResultsMessage,
} from "../fixed-messages.ts";

Deno.test("buildSearchResultsMessage returns localized message", () => {
  assertEquals(
    buildSearchResultsMessage("en"),
    "Ooh, I found a few you're going to love!",
  );
  assertEquals(
    buildSearchResultsMessage("es"),
    "¡Mira lo que encontré! Te van a encantar.",
  );
});

Deno.test("buildNoResultsMessage returns localized message", () => {
  const en = buildNoResultsMessage("en");
  const es = buildNoResultsMessage("es");
  assertEquals(en.includes("custom version"), true);
  assertEquals(es.includes("versión personalizada"), true);
});

Deno.test("buildCookedHistoryMessage returns localized message", () => {
  assertEquals(typeof buildCookedHistoryMessage("en"), "string");
  assertEquals(typeof buildCookedHistoryMessage("es"), "string");
});

Deno.test("buildCookedHistoryEmptyMessage returns localized message", () => {
  assertEquals(typeof buildCookedHistoryEmptyMessage("en"), "string");
  assertEquals(typeof buildCookedHistoryEmptyMessage("es"), "string");
});

Deno.test("buildCustomRecipeMessage returns localized message", () => {
  assertEquals(typeof buildCustomRecipeMessage("en"), "string");
  assertEquals(typeof buildCustomRecipeMessage("es"), "string");
});
