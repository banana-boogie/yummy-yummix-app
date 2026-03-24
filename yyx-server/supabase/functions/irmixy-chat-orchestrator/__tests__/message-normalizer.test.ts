import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { normalizeMessagesForAi } from "../message-normalizer.ts";
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
