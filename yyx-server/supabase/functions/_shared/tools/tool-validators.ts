/**
 * Tool Validators
 *
 * Server-side validation for all LLM tool arguments.
 * Never trust model output - validate before execution.
 */

import { SearchRecipesParams } from '../irmixy-schemas.ts';

// ============================================================
// Custom Error
// ============================================================

export class ToolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolValidationError';
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
    throw new ToolValidationError('Expected string, got null/undefined');
  }
  if (typeof input !== 'string') {
    throw new ToolValidationError(`Expected string, got ${typeof input}`);
  }
  return input.trim().slice(0, maxLength);
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
  if (typeof input !== 'string') {
    throw new ToolValidationError(`Expected string enum value, got ${typeof input}`);
  }
  if (!allowed.includes(input as T)) {
    throw new ToolValidationError(
      `Invalid value "${input}". Allowed: ${allowed.join(', ')}`,
    );
  }
  return input as T;
}

/**
 * Validate a UUID string.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUUID(input: unknown): string {
  if (typeof input !== 'string' || !UUID_REGEX.test(input)) {
    throw new ToolValidationError('Invalid UUID format');
  }
  return input;
}

// ============================================================
// Tool-Specific Validators
// ============================================================

/**
 * Validate and sanitize search_recipes tool arguments.
 */
export function validateSearchRecipesParams(raw: unknown): SearchRecipesParams {
  let params: unknown;
  if (typeof raw === 'string') {
    try {
      params = JSON.parse(raw);
    } catch {
      throw new ToolValidationError('Invalid JSON in search_recipes params');
    }
  } else {
    params = raw;
  }

  if (!params || typeof params !== 'object') {
    throw new ToolValidationError('search_recipes params must be an object');
  }

  const p = params as Record<string, unknown>;

  // query is required
  if (!p.query) {
    throw new ToolValidationError('search_recipes requires a "query" parameter');
  }

  return {
    query: sanitizeString(p.query, 200),
    cuisine: p.cuisine ? sanitizeString(p.cuisine, 50) : undefined,
    maxTime: p.maxTime !== undefined ? clampNumber(p.maxTime, 1, 480) : undefined,
    difficulty: p.difficulty !== undefined
      ? validateEnum(p.difficulty, ['easy', 'medium', 'hard'] as const)
      : undefined,
    limit: p.limit !== undefined ? clampNumber(p.limit, 1, 20) : 10,
  };
}
