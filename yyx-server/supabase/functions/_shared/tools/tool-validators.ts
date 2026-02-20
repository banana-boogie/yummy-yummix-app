/**
 * Tool Validators
 *
 * Server-side validation for all LLM tool arguments.
 * Never trust model output - validate before execution.
 */

import { SearchRecipesParams } from "../irmixy-schemas.ts";

// ============================================================
// Custom Error
// ============================================================

export class ToolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolValidationError";
  }
}

// ============================================================
// Validation Helpers
// ============================================================

/**
 * Sanitize a string input: ensure it's a string, trim, and limit length.
 */
export function sanitizeString(input: unknown, maxLength: number): string {
  if (input === undefined || input === null) {
    throw new ToolValidationError("Expected string, got null/undefined");
  }
  if (typeof input !== "string") {
    throw new ToolValidationError(`Expected string, got ${typeof input}`);
  }
  return input.trim().slice(0, maxLength);
}

/**
 * Sanitize an ingredient name for AI prompt quality.
 * - Trims whitespace
 * - Removes special characters that could confuse the AI
 * - Normalizes multiple spaces
 * - Keeps letters, numbers, spaces, hyphens, and common accented chars
 */
export function sanitizeIngredientName(input: string): string {
  return input
    .trim()
    // Remove special characters except letters, numbers, spaces, hyphens, accents
    .replace(/[^\p{L}\p{N}\s\-]/gu, "")
    // Normalize multiple spaces to single space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sanitize search input used in PostgREST filter expressions.
 * Keeps only letters, numbers, spaces, and hyphens to avoid
 * malformed filter syntax and wildcard/operator abuse.
 */
export function sanitizeSearchQuery(input: unknown, maxLength: number): string {
  return sanitizeString(input, maxLength)
    .replace(/[^\p{L}\p{N}\s\-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clamp a numeric value within bounds.
 */
export function clampNumber(input: unknown, min: number, max: number): number {
  const n = Number(input);
  if (isNaN(n)) {
    throw new ToolValidationError(`Expected number, got ${typeof input}`);
  }
  return Math.max(min, Math.min(max, Math.floor(n)));
}

/**
 * Validate that a value is one of the allowed enum values.
 */
export function validateEnum<T extends string>(
  input: unknown,
  allowed: readonly T[],
): T {
  if (typeof input !== "string") {
    throw new ToolValidationError(
      `Expected string enum value, got ${typeof input}`,
    );
  }
  if (!allowed.includes(input as T)) {
    throw new ToolValidationError(
      `Invalid value "${input}". Allowed: ${allowed.join(", ")}`,
    );
  }
  return input as T;
}

/**
 * Validate a UUID string.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUUID(input: unknown): string {
  if (typeof input !== "string" || !UUID_REGEX.test(input)) {
    throw new ToolValidationError("Invalid UUID format");
  }
  return input;
}

// ============================================================
// Tool-Specific Validators
// ============================================================

/**
 * Validate and sanitize search_recipes tool arguments.
 */
// ============================================================
// Generate Recipe Params
// ============================================================

export interface GenerateRecipeParams {
  recipeDescription?: string;
  ingredients: string[];
  cuisinePreference?: string;
  targetTime?: number;
  difficulty?: "easy" | "medium" | "hard";
  additionalRequests?: string;
  useful_items?: string[];
}

/**
 * Validate and sanitize generate_custom_recipe tool arguments.
 */
export function validateGenerateRecipeParams(
  raw: unknown,
): GenerateRecipeParams {
  let params: unknown;
  if (typeof raw === "string") {
    try {
      params = JSON.parse(raw);
    } catch {
      throw new ToolValidationError(
        "Invalid JSON in generate_custom_recipe params",
      );
    }
  } else {
    params = raw;
  }

  if (!params || typeof params !== "object") {
    throw new ToolValidationError(
      "generate_custom_recipe params must be an object",
    );
  }

  const p = params as Record<string, unknown>;

  // Validate ingredients (required)
  if (!Array.isArray(p.ingredients) || p.ingredients.length === 0) {
    throw new ToolValidationError(
      "generate_custom_recipe requires at least one ingredient",
    );
  }

  // Sanitize ingredients array - clean up special chars for better AI prompt quality
  const ingredients = p.ingredients
    .filter((item): item is string =>
      typeof item === "string" && item.trim().length > 0
    )
    .map((item) => sanitizeIngredientName(sanitizeString(item, 100)))
    .filter((item) => item.length > 0) // Filter out items that became empty after sanitization
    .slice(0, 20); // Max 20 ingredients

  if (ingredients.length === 0) {
    throw new ToolValidationError(
      "generate_custom_recipe requires at least one valid ingredient",
    );
  }

  // Validate useful_items (optional)
  let useful_items: string[] | undefined;
  if (Array.isArray(p.useful_items) && p.useful_items.length > 0) {
    useful_items = p.useful_items
      .filter((item): item is string =>
        typeof item === "string" && item.trim().length > 0
      )
      .map((item) => sanitizeString(item, 50))
      .slice(0, 10); // Max 10 equipment items
  }

  return {
    recipeDescription: p.recipeDescription
      ? sanitizeString(p.recipeDescription, 500)
      : undefined,
    ingredients,
    cuisinePreference: p.cuisinePreference
      ? sanitizeString(p.cuisinePreference, 50)
      : undefined,
    targetTime: p.targetTime !== undefined
      ? clampNumber(p.targetTime, 5, 480)
      : undefined,
    difficulty: p.difficulty !== undefined
      ? validateEnum(p.difficulty, ["easy", "medium", "hard"] as const)
      : undefined,
    additionalRequests: p.additionalRequests
      ? sanitizeString(p.additionalRequests, 2000)
      : undefined,
    useful_items,
  };
}

// ============================================================
// Retrieve Cooked Recipes Params
// ============================================================

export interface RetrieveCookedRecipesValidatedParams {
  query?: string;
  timeframe?: string;
}

/**
 * Validate and sanitize retrieve_cooked_recipes tool arguments.
 */
export function validateRetrieveCookedRecipesParams(
  raw: unknown,
): RetrieveCookedRecipesValidatedParams {
  let params: unknown;
  if (typeof raw === "string") {
    try {
      params = JSON.parse(raw);
    } catch {
      throw new ToolValidationError(
        "Invalid JSON in retrieve_cooked_recipes params",
      );
    }
  } else {
    params = raw;
  }

  if (!params || typeof params !== "object") {
    throw new ToolValidationError(
      "retrieve_cooked_recipes params must be an object",
    );
  }

  const p = params as Record<string, unknown>;
  const query = typeof p.query === "string"
    ? sanitizeSearchQuery(p.query, 200)
    : "";

  return {
    query: query.length > 0 ? query : undefined,
    timeframe: p.timeframe ? sanitizeString(p.timeframe, 100) : undefined,
  };
}

// ============================================================
// Search Recipes Params
// ============================================================

export function validateSearchRecipesParams(raw: unknown): SearchRecipesParams {
  let params: unknown;
  if (typeof raw === "string") {
    try {
      params = JSON.parse(raw);
    } catch {
      throw new ToolValidationError("Invalid JSON in search_recipes params");
    }
  } else {
    params = raw;
  }

  if (!params || typeof params !== "object") {
    throw new ToolValidationError("search_recipes params must be an object");
  }

  const p = params as Record<string, unknown>;

  const sanitizedQuery = p.query !== undefined && p.query !== null
    ? sanitizeSearchQuery(p.query, 200)
    : "";
  const hasQuery = sanitizedQuery.length > 0;
  const hasFilters = p.cuisine !== undefined || p.maxTime !== undefined ||
    p.difficulty !== undefined;

  if (!hasQuery && !hasFilters) {
    throw new ToolValidationError(
      "search_recipes requires a query or at least one filter",
    );
  }

  return {
    query: hasQuery ? sanitizedQuery : undefined,
    cuisine: p.cuisine ? sanitizeString(p.cuisine, 50) : undefined,
    maxTime: p.maxTime !== undefined
      ? clampNumber(p.maxTime, 1, 480)
      : undefined,
    difficulty: p.difficulty !== undefined
      ? validateEnum(p.difficulty, ["easy", "medium", "hard"] as const)
      : undefined,
    limit: p.limit !== undefined ? clampNumber(p.limit, 1, 20) : 10,
  };
}
