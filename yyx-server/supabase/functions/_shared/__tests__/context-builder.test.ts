/**
 * Context Builder Tests
 *
 * Tests for conversation history tool result summarization:
 * - Search results summarization
 * - Generated recipe summarization
 * - Combined tool results
 * - Edge cases (empty, malformed, missing fields)
 */

import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";
import {
  sanitizeContent,
  summarizeHistoryToolResults,
} from "../context-builder.ts";

// --- summarizeHistoryToolResults ---

Deno.test("summarizeHistoryToolResults - search results with full attributes", () => {
  const result = summarizeHistoryToolResults({
    recipes: [
      {
        name: "Banana Bread",
        totalTime: 45,
        difficulty: "easy",
        portions: 4,
        allergenWarnings: ["gluten", "eggs"],
      },
      {
        name: "Chocolate Cake",
        totalTime: 60,
        difficulty: "medium",
        portions: 8,
        allergenWarnings: [],
      },
    ],
  });
  assertEquals(
    result,
    "[Showed 2 recipe(s): Banana Bread, 45 min, easy, 4 portions, allergens: gluten, eggs | Chocolate Cake, 60 min, medium, 8 portions]",
  );
});

Deno.test("summarizeHistoryToolResults - search results with partial attributes", () => {
  const result = summarizeHistoryToolResults({
    recipes: [
      { name: "Quick Salad" },
      { name: "Pasta", totalTime: 20 },
    ],
  });
  assertEquals(
    result,
    "[Showed 2 recipe(s): Quick Salad | Pasta, 20 min]",
  );
});

Deno.test("summarizeHistoryToolResults - single search result", () => {
  const result = summarizeHistoryToolResults({
    recipes: [
      { name: "Soup", totalTime: 30, difficulty: "easy", portions: 4 },
    ],
  });
  assertEquals(
    result,
    "[Showed 1 recipe(s): Soup, 30 min, easy, 4 portions]",
  );
});

Deno.test("summarizeHistoryToolResults - generated recipe with full attributes", () => {
  const result = summarizeHistoryToolResults({
    customRecipe: {
      suggestedName: "Healthy Green Bowl",
      ingredients: [
        { name: "spinach" },
        { name: "avocado" },
        { name: "quinoa" },
      ],
      totalTime: 25,
      portions: 2,
      difficulty: "easy",
    },
  });
  assertEquals(
    result,
    '[Generated recipe: "Healthy Green Bowl", ingredients: spinach, avocado, quinoa, 25 min, 2 portions, easy]',
  );
});

Deno.test("summarizeHistoryToolResults - generated recipe uses 'ingredient' field as fallback", () => {
  const result = summarizeHistoryToolResults({
    customRecipe: {
      suggestedName: "Test Recipe",
      ingredients: [
        { ingredient: "flour" },
        { name: "sugar" },
      ],
      totalTime: 30,
    },
  });
  assertEquals(
    result,
    '[Generated recipe: "Test Recipe", ingredients: flour, sugar, 30 min]',
  );
});

Deno.test("summarizeHistoryToolResults - generated recipe with minimal attributes", () => {
  const result = summarizeHistoryToolResults({
    customRecipe: {
      suggestedName: "Mystery Dish",
    },
  });
  assertEquals(result, '[Generated recipe: "Mystery Dish"]');
});

Deno.test("summarizeHistoryToolResults - both search results and generated recipe", () => {
  const result = summarizeHistoryToolResults({
    recipes: [
      { name: "Pasta Salad", totalTime: 15, difficulty: "easy", portions: 4 },
    ],
    customRecipe: {
      suggestedName: "Custom Pasta",
      ingredients: [{ name: "pasta" }, { name: "tomato" }],
      totalTime: 20,
    },
  });
  assertEquals(
    result,
    '[Showed 1 recipe(s): Pasta Salad, 15 min, easy, 4 portions] [Generated recipe: "Custom Pasta", ingredients: pasta, tomato, 20 min]',
  );
});

Deno.test("summarizeHistoryToolResults - empty object returns empty string", () => {
  assertEquals(summarizeHistoryToolResults({}), "");
});

Deno.test("summarizeHistoryToolResults - empty recipes array returns empty string", () => {
  assertEquals(summarizeHistoryToolResults({ recipes: [] }), "");
});

Deno.test("summarizeHistoryToolResults - recipes is not an array returns empty string", () => {
  assertEquals(
    summarizeHistoryToolResults({ recipes: "not an array" }),
    "",
  );
});

Deno.test("summarizeHistoryToolResults - customRecipe is null returns empty string", () => {
  assertEquals(
    summarizeHistoryToolResults({ customRecipe: null }),
    "",
  );
});

Deno.test("summarizeHistoryToolResults - customRecipe is a string (not object) returns empty string", () => {
  assertEquals(
    summarizeHistoryToolResults({ customRecipe: "not an object" }),
    "",
  );
});

Deno.test("summarizeHistoryToolResults - recipe with empty ingredients array", () => {
  const result = summarizeHistoryToolResults({
    customRecipe: {
      suggestedName: "Empty Recipe",
      ingredients: [],
      totalTime: 10,
    },
  });
  assertEquals(result, '[Generated recipe: "Empty Recipe", 10 min]');
});

Deno.test("summarizeHistoryToolResults - recipe with ingredients missing name fields", () => {
  const result = summarizeHistoryToolResults({
    customRecipe: {
      suggestedName: "Weird Recipe",
      ingredients: [{ amount: 1 }, { unit: "cup" }],
    },
  });
  assertEquals(result, '[Generated recipe: "Weird Recipe"]');
});

Deno.test("summarizeHistoryToolResults - unrelated keys are ignored", () => {
  assertEquals(
    summarizeHistoryToolResults({ someOtherKey: "value", count: 42 }),
    "",
  );
});

// --- sanitizeContent (existing function, basic coverage) ---

Deno.test("sanitizeContent - strips control characters", () => {
  assertEquals(sanitizeContent("hello\x00world"), "helloworld");
});

Deno.test("sanitizeContent - preserves newlines and tabs", () => {
  assertEquals(sanitizeContent("hello\n\tworld"), "hello\n\tworld");
});

Deno.test("sanitizeContent - returns empty string for falsy input", () => {
  assertEquals(sanitizeContent(""), "");
});

Deno.test("sanitizeContent - truncates to MAX_CONTENT_LENGTH", () => {
  const long = "a".repeat(3000);
  assertEquals(sanitizeContent(long).length, 2000);
});
