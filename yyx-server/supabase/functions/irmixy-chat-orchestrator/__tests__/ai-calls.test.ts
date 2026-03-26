import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { callAI } from "../ai-calls.ts";
import type { ChatMessage } from "../types.ts";

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
  const previousTextModel = Deno.env.get("AI_TEXT_MODEL");

  Deno.env.set("OPENAI_API_KEY", "test-key");
  Deno.env.set("AI_TEXT_MODEL", "openai:gpt-4o-mini");
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
    if (previousTextModel) Deno.env.set("AI_TEXT_MODEL", previousTextModel);
    else Deno.env.delete("AI_TEXT_MODEL");
  }
});
