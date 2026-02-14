import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { normalizeMessagesForAi } from "../message-normalizer.ts";
import type { ChatMessage } from "../types.ts";

Deno.test("normalizeMessagesForAi folds tool results into assistant context with summary", () => {
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
      content: JSON.stringify([{
        name: "Pasta Carbonara",
        totalTime: 30,
        cuisine: "Italian",
      }]),
      tool_call_id: "tool_1",
    },
    { role: "assistant", content: "Here are results" },
  ];

  const result = normalizeMessagesForAi(input);

  assertEquals(result.length, 4);
  assertEquals(result[2].role, "assistant");
  assertEquals(
    result[2].content.includes("[Tool result]: Found 1 recipe(s)"),
    true,
  );
  assertEquals(
    result[2].content.includes("Pasta Carbonara"),
    true,
  );
});

Deno.test("normalizeMessagesForAi summarizes standalone tool message", () => {
  const input: ChatMessage[] = [
    { role: "system", content: "system" },
    { role: "tool", content: '{"ok":true}', tool_call_id: "tool_1" },
  ];

  const result = normalizeMessagesForAi(input);

  assertEquals(result.length, 2);
  assertEquals(result[1].role, "assistant");
  // Small JSON objects pass through as-is (under 300 char limit)
  assertEquals(result[1].content, '[Tool result]: {"ok":true}');
});

Deno.test("normalizeMessagesForAi summarizes custom recipe result", () => {
  const input: ChatMessage[] = [
    { role: "system", content: "system" },
    {
      role: "assistant",
      content: "",
      tool_calls: [{
        id: "tool_1",
        type: "function",
        function: {
          name: "generate_custom_recipe",
          arguments: "{}",
        },
      }],
    },
    {
      role: "tool",
      content: JSON.stringify({
        recipe: { suggestedName: "Chicken Stir Fry" },
      }),
      tool_call_id: "tool_1",
    },
  ];

  const result = normalizeMessagesForAi(input);

  assertEquals(result.length, 2);
  assertEquals(
    result[1].content.includes('Custom recipe generated: "Chicken Stir Fry"'),
    true,
  );
});

Deno.test("normalizeMessagesForAi summarizes large unknown JSON objects by listing keys", () => {
  const largeObj: Record<string, unknown> = {
    id: "abc-123",
    status: "complete",
    data: { nested: "value".repeat(50) },
    metadata: { foo: "bar", baz: 42 },
    extra: "padding to exceed 200 chars " + "x".repeat(200),
  };
  const input: ChatMessage[] = [
    { role: "system", content: "system" },
    {
      role: "assistant",
      content: "",
      tool_calls: [{
        id: "tool_1",
        type: "function",
        function: { name: "some_tool", arguments: "{}" },
      }],
    },
    {
      role: "tool",
      content: JSON.stringify(largeObj),
      tool_call_id: "tool_1",
    },
  ];

  const result = normalizeMessagesForAi(input);

  assertEquals(result.length, 2);
  assertEquals(
    result[1].content.includes(
      "Tool returned object with keys: id, status, data, metadata, extra",
    ),
    true,
  );
  // Should NOT contain raw JSON
  assertEquals(result[1].content.includes('"nested"'), false);
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
