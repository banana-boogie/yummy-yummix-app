import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  clampNumber,
  sanitizeString,
  ToolValidationError,
  validateEnum,
  validateSearchRecipesParams,
  validateUUID,
} from "./tool-validators.ts";

// ============================================================
// sanitizeString Tests
// ============================================================

Deno.test("sanitizeString trims whitespace", () => {
  assertEquals(sanitizeString("  hello  ", 100), "hello");
});

Deno.test("sanitizeString limits length", () => {
  assertEquals(sanitizeString("hello world", 5), "hello");
});

Deno.test("sanitizeString rejects null", () => {
  assertThrows(() => sanitizeString(null, 100), ToolValidationError);
});

Deno.test("sanitizeString rejects undefined", () => {
  assertThrows(() => sanitizeString(undefined, 100), ToolValidationError);
});

Deno.test("sanitizeString rejects non-string types", () => {
  assertThrows(
    () => sanitizeString(123, 100),
    ToolValidationError,
    "Expected string",
  );
  assertThrows(
    () => sanitizeString({}, 100),
    ToolValidationError,
    "Expected string",
  );
  assertThrows(
    () => sanitizeString([], 100),
    ToolValidationError,
    "Expected string",
  );
});

// ============================================================
// clampNumber Tests
// ============================================================

Deno.test("clampNumber clamps below minimum", () => {
  assertEquals(clampNumber(-10, 1, 100), 1);
  assertEquals(clampNumber(0, 1, 100), 1);
});

Deno.test("clampNumber clamps above maximum", () => {
  assertEquals(clampNumber(999, 1, 100), 100);
  assertEquals(clampNumber(1000, 1, 20), 20);
});

Deno.test("clampNumber passes through valid values", () => {
  assertEquals(clampNumber(50, 1, 100), 50);
  assertEquals(clampNumber(1, 1, 100), 1);
  assertEquals(clampNumber(100, 1, 100), 100);
});

Deno.test("clampNumber floors decimal values", () => {
  assertEquals(clampNumber(5.7, 1, 100), 5);
  assertEquals(clampNumber(5.2, 1, 100), 5);
});

Deno.test("clampNumber converts string numbers", () => {
  assertEquals(clampNumber("50", 1, 100), 50);
  assertEquals(clampNumber("999", 1, 100), 100);
});

Deno.test("clampNumber rejects NaN inputs", () => {
  assertThrows(() => clampNumber("not a number", 1, 100), ToolValidationError);
  assertThrows(() => clampNumber({}, 1, 100), ToolValidationError);
});

// ============================================================
// validateEnum Tests
// ============================================================

Deno.test("validateEnum accepts valid values", () => {
  assertEquals(validateEnum("easy", ["easy", "medium", "hard"]), "easy");
  assertEquals(validateEnum("medium", ["easy", "medium", "hard"]), "medium");
  assertEquals(validateEnum("hard", ["easy", "medium", "hard"]), "hard");
});

Deno.test("validateEnum rejects invalid values", () => {
  assertThrows(
    () => validateEnum("expert", ["easy", "medium", "hard"]),
    ToolValidationError,
    'Invalid value "expert"',
  );
});

Deno.test("validateEnum rejects non-string values", () => {
  assertThrows(
    () => validateEnum(123, ["easy", "medium", "hard"]),
    ToolValidationError,
    "Expected string enum value",
  );
});

// ============================================================
// validateUUID Tests
// ============================================================

Deno.test("validateUUID accepts valid UUIDs", () => {
  assertEquals(
    validateUUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  );
  assertEquals(
    validateUUID("A1B2C3D4-E5F6-7890-ABCD-EF1234567890"),
    "A1B2C3D4-E5F6-7890-ABCD-EF1234567890",
  );
});

Deno.test("validateUUID rejects invalid formats", () => {
  assertThrows(
    () => validateUUID("not-a-uuid"),
    ToolValidationError,
    "Invalid UUID",
  );
  assertThrows(
    () => validateUUID("a1b2c3d4e5f67890abcdef1234567890"),
    ToolValidationError,
  );
  assertThrows(() => validateUUID(""), ToolValidationError);
  assertThrows(() => validateUUID(123), ToolValidationError);
});

// ============================================================
// validateSearchRecipesParams Tests
// ============================================================

Deno.test("validateSearchRecipesParams allows filter-only searches", () => {
  const params = validateSearchRecipesParams({
    cuisine: "Italian",
    maxTime: 30,
  });
  assertEquals(params.cuisine, "Italian");
  assertEquals(params.maxTime, 30);
});

Deno.test("validateSearchRecipesParams rejects empty input", () => {
  assertThrows(
    () => validateSearchRecipesParams({}),
    ToolValidationError,
    "search_recipes requires a query or at least one filter",
  );
});

Deno.test("validateSearchRecipesParams sanitizes commas in query", () => {
  const params = validateSearchRecipesParams({ query: "pasta, salad" });
  assertEquals(params.query?.includes(","), false);
});

Deno.test("validateSearchRecipesParams rejects whitespace-only query without filters", () => {
  assertThrows(
    () => validateSearchRecipesParams({ query: "   " }),
    ToolValidationError,
    "search_recipes requires a query or at least one filter",
  );
});

Deno.test("validateSearchRecipesParams clamps maxTime to valid range", () => {
  // Too low - clamps to 1
  const tooLow = validateSearchRecipesParams({ maxTime: -10, cuisine: "any" });
  assertEquals(tooLow.maxTime, 1);

  // Too high - clamps to 480
  const tooHigh = validateSearchRecipesParams({
    maxTime: 1000,
    cuisine: "any",
  });
  assertEquals(tooHigh.maxTime, 480);
});

Deno.test("validateSearchRecipesParams clamps limit to valid range", () => {
  // Too low - clamps to 1
  const tooLow = validateSearchRecipesParams({ limit: 0, cuisine: "any" });
  assertEquals(tooLow.limit, 1);

  // Too high - clamps to 20
  const tooHigh = validateSearchRecipesParams({ limit: 100, cuisine: "any" });
  assertEquals(tooHigh.limit, 20);
});

Deno.test("validateSearchRecipesParams rejects invalid difficulty enum", () => {
  assertThrows(
    () => validateSearchRecipesParams({ difficulty: "expert", cuisine: "any" }),
    ToolValidationError,
    'Invalid value "expert"',
  );
});

Deno.test("validateSearchRecipesParams accepts valid difficulty enum", () => {
  assertEquals(
    validateSearchRecipesParams({ difficulty: "easy", cuisine: "any" })
      .difficulty,
    "easy",
  );
  assertEquals(
    validateSearchRecipesParams({ difficulty: "medium", cuisine: "any" })
      .difficulty,
    "medium",
  );
  assertEquals(
    validateSearchRecipesParams({ difficulty: "hard", cuisine: "any" })
      .difficulty,
    "hard",
  );
});

Deno.test("validateSearchRecipesParams defaults limit to 10", () => {
  const params = validateSearchRecipesParams({ cuisine: "Italian" });
  assertEquals(params.limit, 10);
});

Deno.test("validateSearchRecipesParams handles JSON string input", () => {
  const params = validateSearchRecipesParams(
    '{"cuisine": "Mexican", "maxTime": 45}',
  );
  assertEquals(params.cuisine, "Mexican");
  assertEquals(params.maxTime, 45);
});

Deno.test("validateSearchRecipesParams rejects invalid JSON string", () => {
  assertThrows(
    () => validateSearchRecipesParams("not valid json"),
    ToolValidationError,
    "Invalid JSON",
  );
});

Deno.test("validateSearchRecipesParams truncates long queries", () => {
  const longQuery = "a".repeat(300);
  const params = validateSearchRecipesParams({ query: longQuery });
  assertEquals(params.query?.length, 200);
});

Deno.test("validateSearchRecipesParams handles SQL injection attempts", () => {
  // These should be sanitized, not cause errors
  const params1 = validateSearchRecipesParams({
    query: "'; DROP TABLE recipes;--",
  });
  assertEquals(params1.query?.includes(";"), true); // We only strip commas, SQL is handled by parameterized queries

  // Commas are stripped
  const params2 = validateSearchRecipesParams({
    query: "test, SELECT * FROM users",
  });
  assertEquals(params2.query?.includes(","), false);
});
