/**
 * Tool-call text helper tests
 *
 * Verifies detection and sanitization of plain-text tool-call leakage.
 */

import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { detectTextToolCall, stripToolCallText } from "../tool-call-text.ts";

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
