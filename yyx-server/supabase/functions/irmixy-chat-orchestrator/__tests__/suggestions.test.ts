import { assertEquals } from "std/assert/mod.ts";
import { buildSuggestions } from "../suggestions.ts";

Deno.test("buildSuggestions — returns empty when recipe already generated", () => {
  const result = buildSuggestions(
    "make me a chicken soup",
    "Here's your recipe!",
    false,
    true, // hasCustomRecipe
    "en",
  );
  assertEquals(result.length, 0);
});

Deno.test("buildSuggestions — returns empty when recipes found", () => {
  const result = buildSuggestions(
    "find me a pasta recipe",
    "I found some recipes for you.",
    true, // hasRecipeResults
    false,
    "en",
  );
  assertEquals(result.length, 0);
});

Deno.test("buildSuggestions — detects English user wanting a recipe", () => {
  const result = buildSuggestions(
    "make me a chicken soup",
    "That sounds delicious!",
    false,
    false,
    "en",
  );
  assertEquals(result.length, 1);
  assertEquals(result[0].type, "recipe_generation");
  assertEquals(result[0].label.includes("chicken soup"), true);
  assertEquals(result[0].message.includes("chicken soup"), true);
});

Deno.test("buildSuggestions — detects 'I want to cook' pattern", () => {
  const result = buildSuggestions(
    "I want to make ice cream",
    "Ice cream is fun to make at home!",
    false,
    false,
    "en",
  );
  assertEquals(result.length, 1);
  assertEquals(result[0].label.includes("ice cream"), true);
});

Deno.test("buildSuggestions — detects Spanish user wanting a recipe", () => {
  const result = buildSuggestions(
    "hazme una sopa de pollo",
    "Que buena idea!",
    false,
    false,
    "es-MX",
  );
  assertEquals(result.length, 1);
  assertEquals(result[0].type, "recipe_generation");
  assertEquals(result[0].label.includes("sopa de pollo"), true);
});

Deno.test("buildSuggestions — detects Spanish 'quiero hacer' pattern", () => {
  const result = buildSuggestions(
    "quiero hacer tacos al pastor",
    "Los tacos al pastor son deliciosos!",
    false,
    false,
    "es",
  );
  assertEquals(result.length, 1);
  assertEquals(result[0].label.includes("tacos al pastor"), true);
});

Deno.test("buildSuggestions — detects AI hint at recipe creation", () => {
  const result = buildSuggestions(
    "what about brownies",
    "I'd be happy to create a brownie recipe for you!",
    false,
    false,
    "en",
  );
  assertEquals(result.length, 1);
  assertEquals(result[0].type, "recipe_generation");
});

Deno.test("buildSuggestions — returns empty for info question", () => {
  const result = buildSuggestions(
    "how do I brown meat in the thermomix",
    "Browning in the Thermomix uses high temperature mode.",
    false,
    false,
    "en",
  );
  assertEquals(result.length, 0);
});

Deno.test("buildSuggestions — returns empty for empty strings", () => {
  const result = buildSuggestions("", "", false, false, "en");
  assertEquals(result.length, 0);
});

Deno.test("buildSuggestions — falls back to generic name when no pattern matches", () => {
  const result = buildSuggestions(
    "something yummy",
    "I can create something special for you!",
    false,
    false,
    "en",
  );
  assertEquals(result.length, 1);
  assertEquals(result[0].label.includes("this dish"), true);
});

Deno.test("buildSuggestions — Spanish fallback uses 'este platillo'", () => {
  const result = buildSuggestions(
    "algo rico",
    "Puedo crear algo especial para ti!",
    false,
    false,
    "es",
  );
  assertEquals(result.length, 1);
  assertEquals(result[0].label.includes("este platillo"), true);
});

Deno.test("buildSuggestions — strips trailing punctuation from recipe name", () => {
  const result = buildSuggestions(
    "make me a chicken soup!",
    "Great idea!",
    false,
    false,
    "en",
  );
  assertEquals(result.length, 1);
  assertEquals(result[0].label.includes("chicken soup!"), false);
  assertEquals(result[0].label.includes("chicken soup"), true);
});
