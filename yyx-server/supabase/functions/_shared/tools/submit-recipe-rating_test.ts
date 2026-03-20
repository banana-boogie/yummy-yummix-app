/**
 * Submit Recipe Rating Tool Tests
 *
 * Tests for the submit_recipe_rating tool that allows Irmixy to
 * submit ratings on behalf of users.
 *
 * Covers:
 * - Parameter validation (valid, invalid, edge cases)
 * - Rating clamping to 1-5 range
 * - Missing required fields
 * - Feedback sanitization
 */

import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { validateSubmitRecipeRatingParams } from "./submit-recipe-rating.ts";
import { ToolValidationError } from "./tool-validators.ts";

// ============================================================
// Parameter Validation: Positive Path
// ============================================================

Deno.test("validateSubmitRecipeRatingParams - accepts valid params with rating and recipe_name", () => {
  const result = validateSubmitRecipeRatingParams({
    recipe_name: "Pollo al Limon",
    rating: 5,
  });
  assertEquals(result.recipe_name, "Pollo al Limon");
  assertEquals(result.rating, 5);
  assertEquals(result.feedback, undefined);
});

Deno.test("validateSubmitRecipeRatingParams - accepts valid params with feedback", () => {
  const result = validateSubmitRecipeRatingParams({
    recipe_name: "Pasta Carbonara",
    rating: 4,
    feedback: "Estuvo muy rica, pero le falta un poco de sal",
  });
  assertEquals(result.recipe_name, "Pasta Carbonara");
  assertEquals(result.rating, 4);
  assertEquals(
    result.feedback,
    "Estuvo muy rica, pero le falta un poco de sal",
  );
});

Deno.test("validateSubmitRecipeRatingParams - parses JSON string input", () => {
  const result = validateSubmitRecipeRatingParams(
    JSON.stringify({ recipe_name: "Tacos", rating: 3 }),
  );
  assertEquals(result.recipe_name, "Tacos");
  assertEquals(result.rating, 3);
});

Deno.test("validateSubmitRecipeRatingParams - trims recipe_name whitespace", () => {
  const result = validateSubmitRecipeRatingParams({
    recipe_name: "  Sopa de Tortilla  ",
    rating: 5,
  });
  assertEquals(result.recipe_name, "Sopa de Tortilla");
});

Deno.test("validateSubmitRecipeRatingParams - ignores empty feedback string", () => {
  const result = validateSubmitRecipeRatingParams({
    recipe_name: "Enchiladas",
    rating: 4,
    feedback: "   ",
  });
  assertEquals(result.feedback, undefined);
});

// ============================================================
// Parameter Validation: Rating Clamping
// ============================================================

Deno.test("validateSubmitRecipeRatingParams - clamps rating below 1 to 1", () => {
  const result = validateSubmitRecipeRatingParams({
    recipe_name: "Test Recipe",
    rating: 0,
  });
  assertEquals(result.rating, 1);
});

Deno.test("validateSubmitRecipeRatingParams - clamps rating above 5 to 5", () => {
  const result = validateSubmitRecipeRatingParams({
    recipe_name: "Test Recipe",
    rating: 10,
  });
  assertEquals(result.rating, 5);
});

Deno.test("validateSubmitRecipeRatingParams - floors decimal rating", () => {
  const result = validateSubmitRecipeRatingParams({
    recipe_name: "Test Recipe",
    rating: 3.7,
  });
  assertEquals(result.rating, 3);
});

// ============================================================
// Parameter Validation: Negative Path
// ============================================================

Deno.test("validateSubmitRecipeRatingParams - rejects null input", () => {
  assertThrows(
    () => validateSubmitRecipeRatingParams(null),
    ToolValidationError,
    "submit_recipe_rating params must be an object",
  );
});

Deno.test("validateSubmitRecipeRatingParams - rejects plain string as invalid JSON", () => {
  assertThrows(
    () => validateSubmitRecipeRatingParams("not an object"),
    ToolValidationError,
    "Invalid JSON in submit_recipe_rating params",
  );
});

Deno.test("validateSubmitRecipeRatingParams - rejects non-object types like number", () => {
  assertThrows(
    () => validateSubmitRecipeRatingParams(42),
    ToolValidationError,
    "submit_recipe_rating params must be an object",
  );
});

Deno.test("validateSubmitRecipeRatingParams - rejects missing recipe_name", () => {
  assertThrows(
    () => validateSubmitRecipeRatingParams({ rating: 5 }),
    ToolValidationError,
    "submit_recipe_rating requires a non-empty recipe_name",
  );
});

Deno.test("validateSubmitRecipeRatingParams - rejects empty recipe_name", () => {
  assertThrows(
    () => validateSubmitRecipeRatingParams({ recipe_name: "", rating: 5 }),
    ToolValidationError,
    "submit_recipe_rating requires a non-empty recipe_name",
  );
});

Deno.test("validateSubmitRecipeRatingParams - rejects whitespace-only recipe_name", () => {
  assertThrows(
    () => validateSubmitRecipeRatingParams({ recipe_name: "   ", rating: 5 }),
    ToolValidationError,
    "submit_recipe_rating requires a non-empty recipe_name",
  );
});

Deno.test("validateSubmitRecipeRatingParams - rejects missing rating", () => {
  assertThrows(
    () => validateSubmitRecipeRatingParams({ recipe_name: "Test Recipe" }),
    ToolValidationError,
    "submit_recipe_rating requires a rating",
  );
});

Deno.test("validateSubmitRecipeRatingParams - rejects non-numeric rating", () => {
  assertThrows(
    () =>
      validateSubmitRecipeRatingParams({
        recipe_name: "Test Recipe",
        rating: "five",
      }),
    ToolValidationError,
    "Expected number",
  );
});

Deno.test("validateSubmitRecipeRatingParams - rejects invalid JSON string", () => {
  assertThrows(
    () => validateSubmitRecipeRatingParams("{invalid json}"),
    ToolValidationError,
    "Invalid JSON in submit_recipe_rating params",
  );
});

// ============================================================
// Feedback Sanitization
// ============================================================

Deno.test("validateSubmitRecipeRatingParams - truncates long feedback to 2000 chars", () => {
  const longFeedback = "a".repeat(3000);
  const result = validateSubmitRecipeRatingParams({
    recipe_name: "Test Recipe",
    rating: 4,
    feedback: longFeedback,
  });
  assertEquals(result.feedback!.length, 2000);
});

Deno.test("validateSubmitRecipeRatingParams - truncates long recipe_name to 200 chars", () => {
  const longName = "a".repeat(300);
  const result = validateSubmitRecipeRatingParams({
    recipe_name: longName,
    rating: 4,
  });
  assertEquals(result.recipe_name.length, 200);
});
