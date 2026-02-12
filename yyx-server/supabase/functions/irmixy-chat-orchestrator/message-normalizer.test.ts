import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { normalizeMessagesForAi } from "./message-normalizer.ts";
import type { ChatMessage } from "./types.ts";

Deno.test("normalizeMessagesForAi folds tool results into assistant context", () => {
  const input: ChatMessage[] = [
    { role: "system", content: "system prompt" },
    { role: "user", content: "Find me recipes" },
    {
      role: "assistant",
      content: "Calling tool",
      tool_calls: [{
        id: "tool_1",
        type: "function",
        function: {
          name: "search_recipes",
          arguments: '{"query":"pasta"}',
        },
      }],
    },
    {
      role: "tool",
      content: '{"recipes":[{"name":"Pasta"}]}',
      tool_call_id: "tool_1",
    },
    { role: "assistant", content: "Here are results" },
  ];

  const result = normalizeMessagesForAi(input);

  assertEquals(result.length, 4);
  assertEquals(result[2].role, "assistant");
  assertEquals(
    result[2].content.includes('[Tool result]: {"recipes"'),
    true,
  );
});

Deno.test("normalizeMessagesForAi converts standalone tool message to assistant context", () => {
  const input: ChatMessage[] = [
    { role: "system", content: "system" },
    { role: "tool", content: '{"ok":true}', tool_call_id: "tool_1" },
  ];

  const result = normalizeMessagesForAi(input);

  assertEquals(result.length, 2);
  assertEquals(result[1].role, "assistant");
  assertEquals(result[1].content, '[Tool result]: {"ok":true}');
});

Deno.test("normalizeMessagesForAi preserves non-tool messages", () => {
  const input: ChatMessage[] = [
    { role: "system", content: "sys" },
    { role: "user", content: "hello" },
    { role: "assistant", content: "hi" },
  ];

  const result = normalizeMessagesForAi(input);

  assertEquals(result, [
    { role: "system", content: "sys" },
    { role: "user", content: "hello" },
    { role: "assistant", content: "hi" },
  ]);
});
