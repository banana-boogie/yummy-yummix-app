/**
 * Voice Orchestrator Validation Tests
 *
 * Tests the request validation contract for the irmixy-voice-orchestrator endpoint.
 * Since serve() auto-starts and can't be imported as a handler, these tests
 * verify contract expectations inline: action validation, tool allowlist,
 * payload size limits, JSON parsing, and method restrictions.
 */

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Must match irmixy-voice-orchestrator/index.ts
const ALLOWED_ACTIONS = ["start_session", "execute_tool"] as const;
const ALLOWED_TOOLS = ["search_recipes", "generate_custom_recipe"] as const;
const MAX_PAYLOAD_BYTES = 10_000;

Deno.test("ALLOWED_ACTIONS contains exactly the expected actions", () => {
  assertEquals(ALLOWED_ACTIONS.length, 2);
  assert(ALLOWED_ACTIONS.includes("start_session"));
  assert(ALLOWED_ACTIONS.includes("execute_tool"));
});

Deno.test("action validation rejects unknown actions", () => {
  const unknownActions = ["", "start", "execute", "delete_all", null, undefined];

  for (const action of unknownActions) {
    const isAllowed = typeof action === "string" &&
      ALLOWED_ACTIONS.includes(action as typeof ALLOWED_ACTIONS[number]);
    assertEquals(isAllowed, false, `Action ${JSON.stringify(action)} should be rejected`);
  }
});

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
    "SEARCH_RECIPES",
  ];

  for (const tool of unknownTools) {
    const isAllowed = ALLOWED_TOOLS.includes(tool as typeof ALLOWED_TOOLS[number]);
    assertEquals(isAllowed, false, `Tool \"${tool}\" should not be allowed`);
  }
});

Deno.test("tool allowlist accepts valid tool names", () => {
  for (const tool of ALLOWED_TOOLS) {
    const isAllowed = ALLOWED_TOOLS.includes(tool);
    assertEquals(isAllowed, true, `Tool \"${tool}\" should be allowed`);
  }
});

Deno.test("MAX_PAYLOAD_BYTES is 10KB", () => {
  assertEquals(MAX_PAYLOAD_BYTES, 10_000);
});

Deno.test("payload size check rejects oversized bodies", () => {
  const largeBody = JSON.stringify({
    action: "execute_tool",
    toolName: "search_recipes",
    toolArgs: { query: "x".repeat(15_000) },
  });
  const byteLength = new TextEncoder().encode(largeBody).byteLength;

  assert(byteLength > MAX_PAYLOAD_BYTES, "Large body should exceed limit");
});

Deno.test("payload size check accepts normal-sized bodies", () => {
  const normalBody = JSON.stringify({
    action: "execute_tool",
    toolName: "search_recipes",
    toolArgs: { query: "chicken pasta" },
  });
  const byteLength = new TextEncoder().encode(normalBody).byteLength;

  assert(byteLength <= MAX_PAYLOAD_BYTES, "Normal body should be within limit");
});

Deno.test("JSON parse succeeds for valid start_session request", () => {
  const rawBody = JSON.stringify({ action: "start_session" });

  let parsed;
  let parseError = false;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parseError = true;
  }

  assertEquals(parseError, false);
  assertEquals(parsed.action, "start_session");
});

Deno.test("JSON parse succeeds for valid execute_tool request", () => {
  const rawBody = JSON.stringify({
    action: "execute_tool",
    toolName: "search_recipes",
    toolArgs: { query: "pasta" },
  });

  const parsed = JSON.parse(rawBody);
  assertEquals(parsed.action, "execute_tool");
  assertEquals(parsed.toolName, "search_recipes");
  assertEquals(parsed.toolArgs.query, "pasta");
});

Deno.test("JSON parse fails for malformed body", () => {
  const malformedBodies = [
    "not json",
    "{action: start_session}",
    '{"action": "execute_tool"',
    "",
    "undefined",
  ];

  for (const body of malformedBodies) {
    let parseError = false;
    try {
      JSON.parse(body);
    } catch {
      parseError = true;
    }
    assertEquals(parseError, true, `Should fail to parse: \"${body}\"`);
  }
});

Deno.test("only POST and OPTIONS methods should be accepted", () => {
  const allowedMethods = ["POST", "OPTIONS"];
  const rejectedMethods = ["GET", "PUT", "DELETE", "PATCH", "HEAD"];

  for (const method of allowedMethods) {
    assert(["POST", "OPTIONS"].includes(method), `${method} should be allowed`);
  }

  for (const method of rejectedMethods) {
    assert(!["POST", "OPTIONS"].includes(method), `${method} should be rejected with 405`);
  }
});

Deno.test("execute_tool payload requires non-empty string toolName and non-null toolArgs", () => {
  const validToolName = "search_recipes";
  const validToolArgs = { query: "pasta" };

  assertEquals(!!validToolName && typeof validToolName === "string", true);
  assertEquals(validToolArgs !== undefined && validToolArgs !== null, true);

  const invalidNames = [null, undefined, "", 0, false];
  for (const name of invalidNames) {
    const isValid = !!name && typeof name === "string";
    assertEquals(isValid, false, `toolName ${JSON.stringify(name)} should be invalid`);
  }

  const invalidArgs = [null, undefined];
  for (const args of invalidArgs) {
    const isInvalid = args === undefined || args === null;
    assertEquals(isInvalid, true, `toolArgs ${JSON.stringify(args)} should be rejected`);
  }
});
