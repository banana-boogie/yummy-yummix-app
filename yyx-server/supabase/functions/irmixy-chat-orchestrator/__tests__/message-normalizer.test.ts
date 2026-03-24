import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  normalizeMessagesForAi,
  normalizeMessagesForToolLoop,
} from "../message-normalizer.ts";
import type { AIMessage } from "../../_shared/ai-gateway/types.ts";
import type { ChatMessage } from "../types.ts";

/** Helper to get content as string (asserts non-null) */
function contentOf(msg: AIMessage): string {
  if (msg.role === "tool") return msg.content;
  return (msg.content ?? "") as string;
}

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
    contentOf(result[2]).includes("Found 1 recipe(s)"),
    true,
  );
  // Should include recipe names so AI can evaluate relevance
  assertEquals(
    contentOf(result[2]).includes("Pasta Carbonara"),
    true,
  );
  assertEquals(
    contentOf(result[2]).includes("Results are shown to the user"),
    true,
  );
});

Deno.test("normalizeMessagesForAi includes allergen warnings from search tool results", () => {
  const input: ChatMessage[] = [
    { role: "system", content: "system prompt" },
    { role: "user", content: "Find me quick dinners" },
    {
      role: "assistant",
      content: "Calling tool",
      tool_calls: [{
        id: "tool_1",
        type: "function",
        function: {
          name: "search_recipes",
          arguments: '{"query":"quick dinner"}',
        },
      }],
    },
    {
      role: "tool",
      content: JSON.stringify([{
        name: "Creamy Pasta",
        totalTime: 25,
        allergenWarnings: ["Contains milk (dairy)"],
        allergenVerificationWarning:
          "Allergen verification is temporarily unavailable.",
      }]),
      tool_call_id: "tool_1",
    },
  ];

  const result = normalizeMessagesForAi(input);

  assertEquals(result.length, 3);
  // Allergen warnings must still reach the AI (safety-critical)
  assertEquals(
    contentOf(result[2]).includes("Contains milk (dairy)"),
    true,
  );
  assertEquals(
    contentOf(result[2]).includes(
      "Allergen verification is temporarily unavailable.",
    ),
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
  assertEquals(contentOf(result[1]), 'The tool returned: {"ok":true}');
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
    contentOf(result[1]).includes('Recipe "Chicken Stir Fry"'),
    true,
  );
  assertEquals(
    contentOf(result[1]).includes("displayed to the user"),
    true,
  );
  assertEquals(
    contentOf(result[1]).includes("Do not list ingredients"),
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
    contentOf(result[1]).includes(
      "Tool returned object with keys: id, status, data, metadata, extra",
    ),
    true,
  );
  // Should NOT contain raw JSON
  assertEquals(contentOf(result[1]).includes('"nested"'), false);
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

// =============================================================================
// normalizeMessagesForToolLoop
// =============================================================================

Deno.test("normalizeMessagesForToolLoop preserves system/user/assistant messages", () => {
  const input: ChatMessage[] = [
    { role: "system", content: "system prompt" },
    { role: "user", content: "hello" },
    { role: "assistant", content: "hi there" },
  ];

  const result = normalizeMessagesForToolLoop(input);

  assertEquals(result, [
    { role: "system", content: "system prompt" },
    { role: "user", content: "hello" },
    { role: "assistant", content: "hi there" },
  ]);
});

Deno.test("normalizeMessagesForToolLoop preserves native tool_calls on assistant messages", () => {
  const input: ChatMessage[] = [
    { role: "system", content: "system" },
    { role: "user", content: "find pasta" },
    {
      role: "assistant",
      content: null,
      tool_calls: [{
        id: "call_123",
        type: "function",
        function: {
          name: "search_recipes",
          arguments: '{"query":"pasta"}',
        },
      }],
    },
  ];

  const result = normalizeMessagesForToolLoop(input);

  assertEquals(result.length, 3);
  const assistantMsg = result[2];
  assertEquals(assistantMsg.role, "assistant");
  if (assistantMsg.role === "assistant") {
    assertEquals(assistantMsg.content, null);
    assertEquals(assistantMsg.tool_calls?.length, 1);
    assertEquals(assistantMsg.tool_calls![0].name, "search_recipes");
    assertEquals(assistantMsg.tool_calls![0].id, "call_123");
    assertEquals(
      (assistantMsg.tool_calls![0].arguments as Record<string, unknown>).query,
      "pasta",
    );
  }
});

Deno.test("normalizeMessagesForToolLoop preserves native tool result messages", () => {
  const input: ChatMessage[] = [
    { role: "system", content: "system" },
    {
      role: "assistant",
      content: null,
      tool_calls: [{
        id: "call_abc",
        type: "function",
        function: {
          name: "search_recipes",
          arguments: '{"query":"soup"}',
        },
      }],
    },
    {
      role: "tool",
      content: JSON.stringify([{ name: "Miso Soup" }]),
      tool_call_id: "call_abc",
    },
  ];

  const result = normalizeMessagesForToolLoop(input);

  assertEquals(result.length, 3);
  const toolMsg = result[2];
  assertEquals(toolMsg.role, "tool");
  if (toolMsg.role === "tool") {
    assertEquals(toolMsg.tool_call_id, "call_abc");
    assertEquals(JSON.parse(toolMsg.content)[0].name, "Miso Soup");
  }
});

Deno.test("normalizeMessagesForToolLoop handles malformed tool_call arguments gracefully", () => {
  const input: ChatMessage[] = [
    { role: "system", content: "system" },
    {
      role: "assistant",
      content: "Searching...",
      tool_calls: [{
        id: "call_bad",
        type: "function",
        function: {
          name: "search_recipes",
          arguments: "not valid json{{{",
        },
      }],
    },
  ];

  const result = normalizeMessagesForToolLoop(input);

  assertEquals(result.length, 2);
  const assistantMsg = result[1];
  if (assistantMsg.role === "assistant") {
    // Malformed arguments should fallback to empty object
    assertEquals(assistantMsg.tool_calls![0].arguments, {});
  }
});
