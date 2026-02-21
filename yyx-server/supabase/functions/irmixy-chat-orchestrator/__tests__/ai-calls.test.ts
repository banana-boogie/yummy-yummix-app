import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { callAI, callAIStream } from "../ai-calls.ts";
import type { ChatMessage } from "../types.ts";

function buildSseResponse(lines: string[]): Response {
  const body = lines.join("\n") + "\n\n";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function baseMessages(): ChatMessage[] {
  return [
    {
      role: "system",
      content: "You are helpful",
    },
    {
      role: "user",
      content: "Hello",
    },
  ];
}

Deno.test("callAI returns usage and model alongside choices", async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = Deno.env.get("OPENAI_API_KEY");

  Deno.env.set("OPENAI_API_KEY", "test-key");
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        id: "chatcmpl_123",
        model: "gpt-4o-mini-2024-07-18",
        choices: [{ message: { content: "Hola" } }],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 7,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

  try {
    const result = await callAI(baseMessages(), false, "auto");

    assertEquals(result.choices.length, 1);
    assertEquals(result.choices[0].message.content, "Hola");
    assertEquals(result.usage.inputTokens, 12);
    assertEquals(result.usage.outputTokens, 7);
    assertEquals(result.model, "gpt-4o-mini-2024-07-18");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) Deno.env.set("OPENAI_API_KEY", previousKey);
    else Deno.env.delete("OPENAI_API_KEY");
  }
});

Deno.test("callAIStream returns content, usage and model when usage chunk is present", async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = Deno.env.get("OPENAI_API_KEY");

  Deno.env.set("OPENAI_API_KEY", "test-key");

  globalThis.fetch = async (_input, init) => {
    const requestBody = JSON.parse(
      String((init as { body?: unknown } | undefined)?.body),
    );

    if (requestBody.stream) {
      return buildSseResponse([
        'data: {"id":"chatcmpl_1","model":"gpt-4o-mini","choices":[{"delta":{"content":"Hi"}}]}',
        'data: {"id":"chatcmpl_1","model":"gpt-4o-mini","choices":[{"delta":{"content":" there"}}]}',
        'data: {"id":"chatcmpl_1","model":"gpt-4o-mini","choices":[],"usage":{"prompt_tokens":20,"completion_tokens":9}}',
        "data: [DONE]",
      ]);
    }

    return new Response("Unexpected non-stream call", { status: 500 });
  };

  try {
    let streamed = "";
    const result = await callAIStream(baseMessages(), (token) => {
      streamed += token;
    });

    assertEquals(streamed, "Hi there");
    assertEquals(result.content, "Hi there");
    assertEquals(result.streamStatus, "success");
    assertExists(result.usage);
    assertEquals(result.usage?.inputTokens, 20);
    assertEquals(result.usage?.outputTokens, 9);
    assertEquals(result.model, "gpt-4o-mini");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) Deno.env.set("OPENAI_API_KEY", previousKey);
    else Deno.env.delete("OPENAI_API_KEY");
  }
});

Deno.test("callAIStream returns partial status when usage chunk is missing", async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = Deno.env.get("OPENAI_API_KEY");

  Deno.env.set("OPENAI_API_KEY", "test-key");

  globalThis.fetch = async (_input, init) => {
    const requestBody = JSON.parse(
      String((init as { body?: unknown } | undefined)?.body),
    );

    if (requestBody.stream) {
      return buildSseResponse([
        'data: {"id":"chatcmpl_2","model":"gpt-4o-mini","choices":[{"delta":{"content":"Hola"}}]}',
        "data: [DONE]",
      ]);
    }

    return new Response("Unexpected non-stream call", { status: 500 });
  };

  try {
    const result = await callAIStream(baseMessages(), () => undefined);

    assertEquals(result.content, "Hola");
    assertEquals(result.usage, null);
    assertEquals(result.streamStatus, "partial");
    assertEquals(result.model, "gpt-4o-mini");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) Deno.env.set("OPENAI_API_KEY", previousKey);
    else Deno.env.delete("OPENAI_API_KEY");
  }
});
