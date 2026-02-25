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
    "(System: showed 2 recipe card(s) to user — Banana Bread, 45 min, easy, 4 portions, allergens: gluten, eggs | Chocolate Cake, 60 min, medium, 8 portions)",
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
    "(System: showed 2 recipe card(s) to user — Quick Salad | Pasta, 20 min)",
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
    "(System: showed 1 recipe card(s) to user — Soup, 30 min, easy, 4 portions)",
  );
});

Deno.test("summarizeHistoryToolResults - generated recipe with full attributes shows only name", () => {
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
    '(System: recipe "Healthy Green Bowl" was generated via tool and shown to user in recipe card)',
  );
});

Deno.test("summarizeHistoryToolResults - generated recipe shows only name regardless of fields", () => {
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
    '(System: recipe "Test Recipe" was generated via tool and shown to user in recipe card)',
  );
});

Deno.test("summarizeHistoryToolResults - generated recipe with minimal attributes", () => {
  const result = summarizeHistoryToolResults({
    customRecipe: {
      suggestedName: "Mystery Dish",
    },
  });
  assertEquals(
    result,
    '(System: recipe "Mystery Dish" was generated via tool and shown to user in recipe card)',
  );
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
    '(System: showed 1 recipe card(s) to user — Pasta Salad, 15 min, easy, 4 portions) (System: recipe "Custom Pasta" was generated via tool and shown to user in recipe card)',
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
  assertEquals(
    result,
    '(System: recipe "Empty Recipe" was generated via tool and shown to user in recipe card)',
  );
});

Deno.test("summarizeHistoryToolResults - recipe with ingredients missing name fields", () => {
  const result = summarizeHistoryToolResults({
    customRecipe: {
      suggestedName: "Weird Recipe",
      ingredients: [{ amount: 1 }, { unit: "cup" }],
    },
  });
  assertEquals(
    result,
    '(System: recipe "Weird Recipe" was generated via tool and shown to user in recipe card)',
  );
});

Deno.test("summarizeHistoryToolResults - unrelated keys are ignored", () => {
  assertEquals(
    summarizeHistoryToolResults({ someOtherKey: "value", count: 42 }),
    "",
  );
});

Deno.test("summarizeHistoryToolResults - sanitizes interpolated summary fields", () => {
  const result = summarizeHistoryToolResults({
    recipes: [{
      name: "Soup\x00",
      allergenWarnings: ["nuts\x07", "\x01"],
    }],
    customRecipe: {
      suggestedName: "Safe\x00Name",
    },
  });
  assertEquals(
    result,
    '(System: showed 1 recipe card(s) to user — Soup, allergens: nuts) (System: recipe "SafeName" was generated via tool and shown to user in recipe card)',
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
