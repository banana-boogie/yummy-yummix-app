import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { normalizeMessagesForToolLoop } from "../message-normalizer.ts";
import type { ChatMessage } from "../types.ts";

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
