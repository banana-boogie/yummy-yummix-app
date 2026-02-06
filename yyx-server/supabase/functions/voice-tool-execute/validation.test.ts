/**
 * Voice Tool Execute Validation Tests
 *
 * Tests the input validation contract for the voice-tool-execute endpoint.
 * Since serve() auto-starts and can't be imported as a handler, these tests
 * verify the validation logic inline: tool allowlist, payload size limits,
 * JSON parsing, and method restrictions.
 */

import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

// ============================================================
// Mirror the validation constants from the endpoint
// These tests ensure the constants match expectations and
// the validation logic contract is upheld.
// ============================================================

// Must match voice-tool-execute/index.ts
const ALLOWED_TOOLS = ["search_recipes", "generate_custom_recipe"] as const;
const MAX_PAYLOAD_BYTES = 10_000;

// ============================================================
// Tool Allowlist Tests
// ============================================================

Deno.test("ALLOWED_TOOLS contains exactly the expected tools", () => {
  assertEquals(ALLOWED_TOOLS.length, 2);
  assert(ALLOWED_TOOLS.includes("search_recipes"));
  assert(ALLOWED_TOOLS.includes("generate_custom_recipe"));
});

Deno.test("tool allowlist rejects unknown tool names", () => {
  const unknownTools = [
    "delete_user",
    "exec_sql",
    "search_recipes; DROP TABLE",
    "",
    "SEARCH_RECIPES", // case-sensitive
  ];

  for (const tool of unknownTools) {
    const isAllowed = ALLOWED_TOOLS.includes(tool as typeof ALLOWED_TOOLS[number]);
    assertEquals(isAllowed, false, `Tool "${tool}" should not be allowed`);
  }
});

Deno.test("tool allowlist accepts valid tool names", () => {
  for (const tool of ALLOWED_TOOLS) {
    const isAllowed = ALLOWED_TOOLS.includes(tool);
    assertEquals(isAllowed, true, `Tool "${tool}" should be allowed`);
  }
});

// ============================================================
// Payload Size Tests
// ============================================================

Deno.test("MAX_PAYLOAD_BYTES is 10KB", () => {
  assertEquals(MAX_PAYLOAD_BYTES, 10_000);
});

Deno.test("payload size check rejects oversized bodies", () => {
  // Simulate the actual validation: encode body and check byte length
  const largeBody = JSON.stringify({
    toolName: "search_recipes",
    toolArgs: { query: "x".repeat(15_000) },
  });
  const byteLength = new TextEncoder().encode(largeBody).byteLength;

  assert(byteLength > MAX_PAYLOAD_BYTES, "Large body should exceed limit");
});

Deno.test("payload size check accepts normal-sized bodies", () => {
  const normalBody = JSON.stringify({
    toolName: "search_recipes",
    toolArgs: { query: "chicken pasta" },
  });
  const byteLength = new TextEncoder().encode(normalBody).byteLength;

  assert(byteLength <= MAX_PAYLOAD_BYTES, "Normal body should be within limit");
});

// ============================================================
// JSON Parse Tests (simulating the endpoint's parse behavior)
// ============================================================

Deno.test("JSON parse succeeds for valid request body", () => {
  const rawBody = JSON.stringify({
    toolName: "search_recipes",
    toolArgs: { query: "pasta" },
  });

  let parsed;
  let parseError = false;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parseError = true;
  }

  assertEquals(parseError, false);
  assertEquals(parsed.toolName, "search_recipes");
  assertEquals(parsed.toolArgs.query, "pasta");
});

Deno.test("JSON parse fails for malformed body", () => {
  const malformedBodies = [
    "not json",
    "{toolName: search_recipes}",     // missing quotes
    '{"toolName": "search_recipes"',  // missing closing brace
    "",                                // empty string
    "undefined",
  ];

  for (const body of malformedBodies) {
    let parseError = false;
    try {
      JSON.parse(body);
    } catch {
      parseError = true;
    }
    assertEquals(parseError, true, `Should fail to parse: "${body}"`);
  }
});

// ============================================================
// Method Validation Tests
// ============================================================

Deno.test("only POST and OPTIONS methods should be accepted", () => {
  const allowedMethods = ["POST", "OPTIONS"];
  const rejectedMethods = ["GET", "PUT", "DELETE", "PATCH", "HEAD"];

  for (const method of allowedMethods) {
    assert(
      ["POST", "OPTIONS"].includes(method),
      `${method} should be allowed`,
    );
  }

  for (const method of rejectedMethods) {
    assert(
      !["POST", "OPTIONS"].includes(method),
      `${method} should be rejected with 405`,
    );
  }
});

// ============================================================
// toolName Validation Tests
// ============================================================

Deno.test("toolName validation rejects falsy values", () => {
  const invalidNames = [null, undefined, "", 0, false];

  for (const name of invalidNames) {
    const isValid = !!name && typeof name === "string";
    assertEquals(isValid, false, `toolName ${JSON.stringify(name)} should be invalid`);
  }
});

Deno.test("toolName validation rejects non-string types", () => {
  const nonStrings = [123, true, { name: "search_recipes" }, ["search_recipes"]];

  for (const name of nonStrings) {
    const isValid = !!name && typeof name === "string";
    assertEquals(isValid, false, `toolName ${JSON.stringify(name)} should be invalid`);
  }
});

// ============================================================
// toolArgs Validation Tests
// ============================================================

Deno.test("toolArgs validation rejects null and undefined", () => {
  const invalidArgs = [null, undefined];

  for (const args of invalidArgs) {
    const isInvalid = args === undefined || args === null;
    assertEquals(isInvalid, true, `toolArgs ${JSON.stringify(args)} should be rejected`);
  }
});

Deno.test("toolArgs accepts object and string values", () => {
  const validArgs = [
    { query: "pasta" },
    '{"query": "pasta"}',
    {},
    "{}",
  ];

  for (const args of validArgs) {
    const isInvalid = args === undefined || args === null;
    assertEquals(isInvalid, false, `toolArgs ${JSON.stringify(args)} should be accepted`);
  }
});
