/**
 * Anthropic Provider Tests
 *
 * Tests for the Anthropic provider:
 * - System message extraction to top-level param
 * - Response translation (content blocks → string)
 * - Auth headers (x-api-key, anthropic-version)
 * - Error handling
 */

import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.220.0/assert/mod.ts";
import {
  callAnthropic,
  translateMessagesForAnthropic,
} from "../providers/anthropic.ts";
import { AICompletionRequest } from "../types.ts";

// =============================================================================
// translateMessagesForAnthropic
// =============================================================================

Deno.test("translateMessagesForAnthropic - extracts system to top-level param", () => {
  const result = translateMessagesForAnthropic([
    { role: "system", content: "You are a chef." },
    { role: "user", content: "Hello!" },
  ]);

  assertEquals(result.system, "You are a chef.");
  assertEquals(result.messages.length, 1);
  assertEquals(result.messages[0].role, "user");
  assertEquals(result.messages[0].content, "Hello!");
});

Deno.test("translateMessagesForAnthropic - concatenates multiple system messages", () => {
  const result = translateMessagesForAnthropic([
    { role: "system", content: "Rule one." },
    { role: "system", content: "Rule two." },
    { role: "user", content: "Hi" },
  ]);

  assertEquals(result.system, "Rule one.\n\nRule two.");
  assertEquals(result.messages.length, 1);
});

Deno.test("translateMessagesForAnthropic - no system messages returns undefined system", () => {
  const result = translateMessagesForAnthropic([
    { role: "user", content: "Hi" },
    { role: "assistant", content: "Hello!" },
  ]);

  assertEquals(result.system, undefined);
  assertEquals(result.messages.length, 2);
  assertEquals(result.messages[0].role, "user");
  assertEquals(result.messages[1].role, "assistant");
});

Deno.test("translateMessagesForAnthropic - preserves user and assistant roles", () => {
  const result = translateMessagesForAnthropic([
    { role: "user", content: "Question" },
    { role: "assistant", content: "Answer" },
    { role: "user", content: "Follow-up" },
  ]);

  assertEquals(result.messages.length, 3);
  assertEquals(result.messages[0].role, "user");
  assertEquals(result.messages[1].role, "assistant");
  assertEquals(result.messages[2].role, "user");
});

// =============================================================================
// callAnthropic
// =============================================================================

Deno.test("callAnthropic - translates response to gateway format", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        id: "msg_123",
        model: "claude-sonnet-4-6",
        content: [{ type: "text", text: "Here is your recipe!" }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  try {
    const result = await callAnthropic(
      {
        usageType: "recipe_creation",
        messages: [
          { role: "system", content: "You are a chef." },
          { role: "user", content: "Make pasta" },
        ],
      },
      "claude-sonnet-4-6",
      "test-key",
    );

    assertEquals(result.content, "Here is your recipe!");
    assertEquals(result.model, "claude-sonnet-4-6");
    assertEquals(result.usage.inputTokens, 100);
    assertEquals(result.usage.outputTokens, 50);
    assertEquals(result.toolCalls, undefined);
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("callAnthropic - concatenates multiple text content blocks", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        id: "msg_456",
        model: "claude-sonnet-4-6",
        content: [
          { type: "text", text: "Part one. " },
          { type: "text", text: "Part two." },
        ],
        usage: { input_tokens: 50, output_tokens: 25 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  try {
    const result = await callAnthropic(
      {
        usageType: "recipe_creation",
        messages: [{ role: "user", content: "Hello" }],
      },
      "claude-sonnet-4-6",
      "test-key",
    );

    assertEquals(result.content, "Part one. Part two.");
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("callAnthropic - sends correct headers", async () => {
  let capturedHeaders: Headers | undefined;
  const original = globalThis.fetch;
  globalThis.fetch = async (
    _input: string | URL | Request,
    init?: RequestInit,
  ) => {
    capturedHeaders = new Headers(init?.headers as HeadersInit);
    return new Response(
      JSON.stringify({
        id: "msg_789",
        model: "claude-sonnet-4-6",
        content: [{ type: "text", text: "ok" }],
        usage: { input_tokens: 5, output_tokens: 1 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    await callAnthropic(
      {
        usageType: "recipe_creation",
        messages: [{ role: "user", content: "Hi" }],
      },
      "claude-sonnet-4-6",
      "my-api-key",
    );

    assertEquals(capturedHeaders?.get("x-api-key"), "my-api-key");
    assertEquals(capturedHeaders?.get("anthropic-version"), "2023-06-01");
    assertEquals(capturedHeaders?.get("Content-Type"), "application/json");
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("callAnthropic - includes system in request body", async () => {
  let capturedBody: string | undefined;
  const original = globalThis.fetch;
  globalThis.fetch = async (
    _input: string | URL | Request,
    init?: RequestInit,
  ) => {
    capturedBody = init?.body as string;
    return new Response(
      JSON.stringify({
        id: "msg_sys",
        model: "claude-sonnet-4-6",
        content: [{ type: "text", text: "ok" }],
        usage: { input_tokens: 5, output_tokens: 1 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    await callAnthropic(
      {
        usageType: "recipe_creation",
        messages: [
          { role: "system", content: "Be a chef." },
          { role: "user", content: "Make a recipe" },
        ],
      },
      "claude-sonnet-4-6",
      "test-key",
    );

    const body = JSON.parse(capturedBody!);
    assertEquals(body.system, "Be a chef.");
    assertEquals(body.messages.length, 1);
    assertEquals(body.messages[0].role, "user");
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("callAnthropic - throws on API error", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("Unauthorized", { status: 401 });

  try {
    await assertRejects(
      () =>
        callAnthropic(
          {
            usageType: "recipe_creation",
            messages: [{ role: "user", content: "Hi" }],
          },
          "claude-sonnet-4-6",
          "bad-key",
        ),
      Error,
      "Anthropic API error (401)",
    );
  } finally {
    globalThis.fetch = original;
  }
});
