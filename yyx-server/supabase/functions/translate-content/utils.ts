/**
 * Translate Content — Pure utility functions (testable without Deno.serve).
 */

// ============================================================
// Types
// ============================================================

export interface TranslateRequest {
  fields: Record<string, string>;
  sourceLocale: string;
  targetLocales: string[];
}

export interface TranslationResult {
  targetLocale: string;
  fields: Record<string, string>;
  error?: string;
}

// ============================================================
// Vocabulary adaptation hints for regional Spanish variants
// ============================================================

export const REGIONAL_ADAPTATION_HINTS: Record<string, string> = {
  "es>es-ES":
    "Adapt Mexican Spanish food terms to Spain Spanish (jitomate\u2192tomate, cacahuate\u2192cacahuete, elote\u2192ma\u00edz, crema\u2192nata, papa\u2192patata, jugo\u2192zumo, ch\u00edcharo\u2192guisante, ejote\u2192jud\u00eda verde).",
  "es-ES>es":
    "Adapt Spain Spanish food terms to Mexican Spanish (tomate\u2192jitomate, cacahuete\u2192cacahuate, ma\u00edz\u2192elote, nata\u2192crema, patata\u2192papa, zumo\u2192jugo, guisante\u2192ch\u00edcharo, jud\u00eda verde\u2192ejote).",
};

// ============================================================
// Validation
// ============================================================

export function validateRequest(body: unknown): TranslateRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }

  const { fields, sourceLocale, targetLocales } = body as Record<
    string,
    unknown
  >;

  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    throw new Error("'fields' must be a non-empty object of string values");
  }

  const fieldEntries = Object.entries(fields as Record<string, unknown>);
  if (fieldEntries.length === 0) {
    throw new Error("'fields' must contain at least one field");
  }
  for (const [key, value] of fieldEntries) {
    if (typeof value !== "string") {
      throw new Error(`Field '${key}' must be a string`);
    }
  }

  if (typeof sourceLocale !== "string" || sourceLocale.length === 0) {
    throw new Error("'sourceLocale' must be a non-empty string");
  }

  if (
    !Array.isArray(targetLocales) || targetLocales.length === 0 ||
    !targetLocales.every((l) => typeof l === "string" && l.length > 0)
  ) {
    throw new Error(
      "'targetLocales' must be a non-empty array of locale strings",
    );
  }

  return {
    fields: fields as Record<string, string>,
    sourceLocale,
    targetLocales,
  };
}

/**
 * Build the JSON schema for the AI response.
 * Matches the shape of the input fields.
 */
export function buildResponseSchema(
  fieldKeys: string[],
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const key of fieldKeys) {
    properties[key] = { type: "string" };
  }
  return {
    type: "object",
    properties,
    required: fieldKeys,
    additionalProperties: false,
  };
}
