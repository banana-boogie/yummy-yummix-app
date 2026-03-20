/**
 * Tool-call text helper tests
 *
 * Verifies detection and sanitization of plain-text tool-call leakage.
 */

import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import {
  detectTextToolCall,
  StreamingToolCallFilter,
  stripToolCallText,
} from "../tool-call-text.ts";

Deno.test("detectTextToolCall detects call:<tool>{...} syntax", () => {
  const content =
    'I can help with that.\ncall:generate_custom_recipe{"ingredients":["chicken"]}';
  assertEquals(detectTextToolCall(content), "generate_custom_recipe");
});

Deno.test("detectTextToolCall detects <tool>{...} syntax", () => {
  const content =
    'I can help with that.\ngenerate_custom_recipe{"ingredients":["chicken"]}';
  assertEquals(detectTextToolCall(content), "generate_custom_recipe");
});

Deno.test("detectTextToolCall returns null for normal content", () => {
  assertEquals(
    detectTextToolCall("Here is a friendly recipe suggestion."),
    null,
  );
});

Deno.test("detectTextToolCall detects bracket-style [Modified recipe:] marker", () => {
  const content =
    'Okay, let\'s try again! [Modified recipe: "Quick Savory Breakfast Burrito"]';
  assertEquals(detectTextToolCall(content), "modify_recipe");
});

Deno.test("detectTextToolCall detects bracket-style [Generated recipe:] marker", () => {
  const content = 'Here is your recipe! [Generated recipe: "Chocolate Cake"]';
  assertEquals(detectTextToolCall(content), "generate_custom_recipe");
});

Deno.test("stripToolCallText strips call:<tool>{...} tail", () => {
  const text =
    'Great idea. Let me prepare that.\ncall:generate_custom_recipe{"ingredients":["tomato"]}';
  assertEquals(stripToolCallText(text), "Great idea. Let me prepare that.");
});

Deno.test("stripToolCallText strips <tool>{...} tail", () => {
  const text =
    'Great idea. Let me prepare that.\ngenerate_custom_recipe{"ingredients":["tomato"]}';
  assertEquals(stripToolCallText(text), "Great idea. Let me prepare that.");
});

Deno.test("stripToolCallText keeps normal text unchanged", () => {
  const text = "Here is your recipe with three easy steps.";
  assertEquals(stripToolCallText(text), text);
});

Deno.test("stripToolCallText safely handles empty input", () => {
  assertEquals(stripToolCallText(""), "");
});

// ============================================================
// Workstream B: Tool Result Leak Fix
// ============================================================

Deno.test("stripToolCallText strips 'The tool returned:' text from end", () => {
  const text =
    "Here are some great chicken recipes!\nThe tool returned: Found 3 recipe(s) matching your search.";
  assertEquals(
    stripToolCallText(text),
    "Here are some great chicken recipes!",
  );
});

Deno.test("stripToolCallText keeps normal text containing 'returned' unchanged", () => {
  const text = "The chicken returned to room temperature before cooking.";
  assertEquals(stripToolCallText(text), text);
});

Deno.test("StreamingToolCallFilter suppresses 'The tool returned:' text", () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  filter.push("Here are some recipes! ");
  filter.push("The tool returned:");
  filter.push(" Found 1 recipe(s).");
  filter.end();

  assertEquals(output.join(""), "Here are some recipes! ");
});

// ============================================================
// Workstream F: XML Tool Call Leak
// ============================================================

Deno.test("detectTextToolCall detects <function_calls> XML syntax", () => {
  const content =
    'Let me search for that.\n<function_calls>\n<invoke name="search_recipes">\n<parameter name="query">chicken</parameter>\n</invoke>\n</function_calls>';
  assertEquals(detectTextToolCall(content), "search_recipes");
});

Deno.test("detectTextToolCall detects <invoke name='tool'> XML syntax", () => {
  const content =
    'I will generate a recipe.\n<invoke name="generate_custom_recipe">\n<parameter name="ingredients">["chicken"]</parameter>\n</invoke>';
  assertEquals(detectTextToolCall(content), "generate_custom_recipe");
});

Deno.test("stripToolCallText strips XML <function_calls> blocks", () => {
  const text =
    'Here is your recipe!\n<function_calls>\n<invoke name="search_recipes">\n<parameter name="query">pasta</parameter>\n</invoke>\n</function_calls>';
  assertEquals(stripToolCallText(text), "Here is your recipe!");
});

Deno.test("stripToolCallText strips unclosed <function_calls> blocks", () => {
  const text =
    'Let me find that.\n<function_calls>\n<invoke name="search_recipes">';
  assertEquals(stripToolCallText(text), "Let me find that.");
});

Deno.test("StreamingToolCallFilter suppresses XML <function_calls> block", () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  filter.push("Great choice! ");
  filter.push("<function_calls>");
  filter.push('\n<invoke name="search_recipes">');
  filter.push('\n<parameter name="query">chicken</parameter>');
  filter.push("\n</invoke>");
  filter.push("\n</function_calls>");
  filter.end();

  assertEquals(output.join(""), "Great choice! ");
});

// ============================================================
// Cross-token "The tool returned:" detection
// ============================================================

Deno.test("StreamingToolCallFilter suppresses 'The tool returned:' split across tokens", () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  filter.push("Here are some recipes! ");
  filter.push("The");
  filter.push(" tool");
  filter.push(" returned");
  filter.push(":");
  filter.push(" Found 1 recipe(s).");
  filter.end();

  assertEquals(output.join(""), "Here are some recipes! ");
});

Deno.test("StreamingToolCallFilter suppresses 'The tool returned:' split into two tokens", () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  filter.push("Great! ");
  filter.push("The tool");
  filter.push(" returned: some data here");
  filter.end();

  assertEquals(output.join(""), "Great! ");
});

Deno.test("StreamingToolCallFilter flushes 'The' when followed by non-matching token", () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  filter.push("Hello ");
  filter.push("The");
  filter.push(" chicken is ready.");
  filter.end();

  assertEquals(output.join(""), "Hello The chicken is ready.");
});

Deno.test("StreamingToolCallFilter flushes partial phrase at end of stream", () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  filter.push("Hello ");
  filter.push("The tool");
  filter.end();

  // "The tool" is a partial match — flushed as false positive at end()
  assertEquals(output.join(""), "Hello The tool");
});

Deno.test("StreamingToolCallFilter passes normal text with angle brackets", () => {
  // Text like "Use <5 min" should NOT be suppressed once buffer exceeds MAX_BUFFER
  // But short angle bracket tokens DO trigger buffering — test that they flush
  // when no suppress pattern matches at buffer end
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  filter.push("Cook for ");
  // A token starting with < that won't match any suppress pattern at end()
  filter.push("<");
  filter.push("5 minutes.");
  filter.end();

  // The "<5 minutes." text should have been flushed (either during or at end)
  assertEquals(output.join(""), "Cook for <5 minutes.");
});
