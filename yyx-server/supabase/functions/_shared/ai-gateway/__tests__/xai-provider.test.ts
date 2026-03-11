/**
 * xAI Provider Tests
 *
 * Tests for the xAI provider (OpenAI-compatible API at api.x.ai):
 * - Request construction (model, messages, tools, structured output)
 * - Response translation to gateway format
 * - Error handling
 */

import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.220.0/assert/mod.ts";
import { callXAI } from "../providers/xai.ts";
import { AICompletionRequest } from "../types.ts";

// =============================================================================
// Helpers
// =============================================================================

function createMockRequest(
  overrides?: Partial<AICompletionRequest>,
): AICompletionRequest {
  return {
    usageType: "recipe_generation",
    messages: [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
    ],
    ...overrides,
  };
}

function mockFetchSuccess(responseData: Record<string, unknown>) {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  return () => {
    globalThis.fetch = original;
  };
}

function mockFetchError(status: number, body: string) {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(body, { status, headers: { "Content-Type": "text/plain" } });
  return () => {
    globalThis.fetch = original;
  };
}

// =============================================================================
// callXAI
// =============================================================================

Deno.test("callXAI - translates response to gateway format", async () => {
  const restore = mockFetchSuccess({
    id: "chatcmpl-123",
    model: "grok-4.1-fast",
    choices: [{
      message: { content: "Hello from Grok!" },
    }],
    usage: { prompt_tokens: 15, completion_tokens: 5 },
  });

  try {
    const result = await callXAI(
      createMockRequest(),
      "grok-4.1-fast",
      "test-key",
    );

    assertEquals(result.content, "Hello from Grok!");
    assertEquals(result.model, "grok-4.1-fast");
    assertEquals(result.usage.inputTokens, 15);
    assertEquals(result.usage.outputTokens, 5);
    assertEquals(result.toolCalls, undefined);
  } finally {
    restore();
  }
});

Deno.test("callXAI - handles tool calls in response", async () => {
  const restore = mockFetchSuccess({
    id: "chatcmpl-456",
    model: "grok-4.1-fast",
    choices: [{
      message: {
        content: null,
        tool_calls: [{
          id: "call_abc",
          function: {
            name: "search_recipes",
            arguments: '{"query":"pasta"}',
          },
        }],
      },
    }],
    usage: { prompt_tokens: 20, completion_tokens: 10 },
  });

  try {
    const result = await callXAI(
      createMockRequest(),
      "grok-4.1-fast",
      "test-key",
    );

    assertEquals(result.content, "");
    assertEquals(result.toolCalls?.length, 1);
    assertEquals(result.toolCalls![0].id, "call_abc");
    assertEquals(result.toolCalls![0].name, "search_recipes");
    assertEquals(result.toolCalls![0].arguments, { query: "pasta" });
  } finally {
    restore();
  }
});

Deno.test("callXAI - throws on API error with status code", async () => {
  const restore = mockFetchError(429, "Rate limit exceeded");

  try {
    await assertRejects(
      () => callXAI(createMockRequest(), "grok-4.1-fast", "test-key"),
      Error,
      "xAI API error (429)",
    );
  } finally {
    restore();
  }
});

Deno.test("callXAI - sends correct request structure", async () => {
  let capturedBody: string | undefined;
  let capturedHeaders: Headers | undefined;
  const original = globalThis.fetch;
  globalThis.fetch = async (
    _input: string | URL | Request,
    init?: RequestInit,
  ) => {
    capturedBody = init?.body as string;
    capturedHeaders = new Headers(init?.headers as HeadersInit);
    return new Response(
      JSON.stringify({
        id: "test",
        model: "grok-4.1-fast",
        choices: [{ message: { content: "ok" } }],
        usage: { prompt_tokens: 5, completion_tokens: 1 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    await callXAI(
      createMockRequest({ temperature: 0.5, maxTokens: 2048 }),
      "grok-4.1-fast",
      "test-api-key",
    );

    const body = JSON.parse(capturedBody!);
    assertEquals(body.model, "grok-4.1-fast");
    assertEquals(body.temperature, 0.5);
    assertEquals(body.max_tokens, 2048);
    assertEquals(body.messages.length, 2);
    assertEquals(capturedHeaders?.get("Authorization"), "Bearer test-api-key");
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("callXAI - handles malformed tool arguments gracefully", async () => {
  const restore = mockFetchSuccess({
    id: "chatcmpl-789",
    model: "grok-4.1-fast",
    choices: [{
      message: {
        content: null,
        tool_calls: [{
          id: "call_bad",
          function: {
            name: "test_tool",
            arguments: "not-valid-json",
          },
        }],
      },
    }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  });

  try {
    const result = await callXAI(
      createMockRequest(),
      "grok-4.1-fast",
      "test-key",
    );

    // Should return empty object for malformed arguments
    assertEquals(result.toolCalls?.[0].arguments, {});
  } finally {
    restore();
  }
});
