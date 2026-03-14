/**
 * Translate Content — Utils Tests
 *
 * Tests for validateRequest, buildResponseSchema, and REGIONAL_ADAPTATION_HINTS.
 */

import {
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import {
  buildResponseSchema,
  REGIONAL_ADAPTATION_HINTS,
  validateRequest,
} from "../utils.ts";

// ============================================================
// validateRequest
// ============================================================

Deno.test("validateRequest throws on null body", () => {
  assertThrows(
    () => validateRequest(null),
    Error,
    "Request body must be a JSON object",
  );
});

Deno.test("validateRequest throws on undefined body", () => {
  assertThrows(
    () => validateRequest(undefined),
    Error,
    "Request body must be a JSON object",
  );
});

Deno.test("validateRequest throws on non-object body", () => {
  assertThrows(
    () => validateRequest("string"),
    Error,
    "Request body must be a JSON object",
  );
});

Deno.test("validateRequest throws when fields is missing", () => {
  assertThrows(
    () => validateRequest({ sourceLocale: "en", targetLocales: ["es"] }),
    Error,
    "'fields' must be a non-empty object",
  );
});

Deno.test("validateRequest throws when fields is an array", () => {
  assertThrows(
    () =>
      validateRequest({
        fields: ["a"],
        sourceLocale: "en",
        targetLocales: ["es"],
      }),
    Error,
    "'fields' must be a non-empty object",
  );
});

Deno.test("validateRequest throws when fields is empty", () => {
  assertThrows(
    () =>
      validateRequest({
        fields: {},
        sourceLocale: "en",
        targetLocales: ["es"],
      }),
    Error,
    "'fields' must contain at least one field",
  );
});

Deno.test("validateRequest throws when field value is not a string", () => {
  assertThrows(
    () =>
      validateRequest({
        fields: { name: 123 },
        sourceLocale: "en",
        targetLocales: ["es"],
      }),
    Error,
    "Field 'name' must be a string",
  );
});

Deno.test("validateRequest throws when sourceLocale is missing", () => {
  assertThrows(
    () => validateRequest({ fields: { name: "test" }, targetLocales: ["es"] }),
    Error,
    "'sourceLocale' must be a non-empty string",
  );
});

Deno.test("validateRequest throws when sourceLocale is empty", () => {
  assertThrows(
    () =>
      validateRequest({
        fields: { name: "test" },
        sourceLocale: "",
        targetLocales: ["es"],
      }),
    Error,
    "'sourceLocale' must be a non-empty string",
  );
});

Deno.test("validateRequest throws when targetLocales is missing", () => {
  assertThrows(
    () => validateRequest({ fields: { name: "test" }, sourceLocale: "en" }),
    Error,
    "'targetLocales' must be a non-empty array",
  );
});

Deno.test("validateRequest throws when targetLocales is empty", () => {
  assertThrows(
    () =>
      validateRequest({
        fields: { name: "test" },
        sourceLocale: "en",
        targetLocales: [],
      }),
    Error,
    "'targetLocales' must be a non-empty array",
  );
});

Deno.test("validateRequest throws when targetLocales contains non-string", () => {
  assertThrows(
    () =>
      validateRequest({
        fields: { name: "test" },
        sourceLocale: "en",
        targetLocales: [123],
      }),
    Error,
    "'targetLocales' must be a non-empty array",
  );
});

Deno.test("validateRequest throws when targetLocales contains empty string", () => {
  assertThrows(
    () =>
      validateRequest({
        fields: { name: "test" },
        sourceLocale: "en",
        targetLocales: [""],
      }),
    Error,
    "'targetLocales' must be a non-empty array",
  );
});

Deno.test("validateRequest returns parsed request for valid input", () => {
  const result = validateRequest({
    fields: { name: "Pollo", tips: "Use fresh" },
    sourceLocale: "es",
    targetLocales: ["en", "es-ES"],
  });

  assertEquals(result.fields, { name: "Pollo", tips: "Use fresh" });
  assertEquals(result.sourceLocale, "es");
  assertEquals(result.targetLocales, ["en", "es-ES"]);
});

Deno.test("validateRequest works with single field and single target", () => {
  const result = validateRequest({
    fields: { name: "Chicken" },
    sourceLocale: "en",
    targetLocales: ["es"],
  });

  assertEquals(Object.keys(result.fields).length, 1);
  assertEquals(result.targetLocales.length, 1);
});

// ============================================================
// buildResponseSchema
// ============================================================

Deno.test("buildResponseSchema returns correct JSON schema shape", () => {
  const schema = buildResponseSchema(["name", "tips"]);

  assertEquals(schema.type, "object");
  assertEquals(schema.additionalProperties, false);
  assertEquals(schema.required, ["name", "tips"]);
  assertEquals((schema.properties as Record<string, unknown>)["name"], {
    type: "string",
  });
  assertEquals((schema.properties as Record<string, unknown>)["tips"], {
    type: "string",
  });
});

Deno.test("buildResponseSchema handles single field", () => {
  const schema = buildResponseSchema(["name"]);

  assertEquals(schema.required, ["name"]);
  assertEquals(
    Object.keys(schema.properties as Record<string, unknown>).length,
    1,
  );
});

Deno.test("buildResponseSchema handles many fields", () => {
  const keys = ["name", "description", "tips", "instructions", "notes"];
  const schema = buildResponseSchema(keys);

  assertEquals(schema.required, keys);
  assertEquals(
    Object.keys(schema.properties as Record<string, unknown>).length,
    5,
  );
});

// ============================================================
// REGIONAL_ADAPTATION_HINTS
// ============================================================

Deno.test("REGIONAL_ADAPTATION_HINTS has es>es-ES mapping", () => {
  const hint = REGIONAL_ADAPTATION_HINTS["es>es-ES"];
  assertEquals(typeof hint, "string");
  assertStringIncludes(hint, "jitomate");
  assertStringIncludes(hint, "tomate");
});

Deno.test("REGIONAL_ADAPTATION_HINTS has es-ES>es mapping", () => {
  const hint = REGIONAL_ADAPTATION_HINTS["es-ES>es"];
  assertEquals(typeof hint, "string");
  assertStringIncludes(hint, "tomate");
  assertStringIncludes(hint, "jitomate");
});

Deno.test("REGIONAL_ADAPTATION_HINTS returns undefined for unknown key", () => {
  assertEquals(REGIONAL_ADAPTATION_HINTS["en>fr"], undefined);
});
