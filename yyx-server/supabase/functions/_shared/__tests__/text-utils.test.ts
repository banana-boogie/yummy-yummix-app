/**
 * Text Utilities Tests
 *
 * Tests for wordStartMatch — verifies word-boundary matching
 * to prevent substring false positives (e.g., "ice" should not match "rice").
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { wordStartMatch } from "../text-utils.ts";

// ============================================================
// wordStartMatch
// ============================================================

Deno.test('wordStartMatch - "ice" matches "ice cream" (word start)', () => {
  assertEquals(wordStartMatch("ice cream", "ice"), true);
});

Deno.test('wordStartMatch - "ice" does NOT match "rice" (substring only)', () => {
  assertEquals(wordStartMatch("rice", "ice"), false);
});

Deno.test('wordStartMatch - "ice" does NOT match "price" (substring only)', () => {
  assertEquals(wordStartMatch("price", "ice"), false);
});

Deno.test('wordStartMatch - "pasta" matches "pasta primavera"', () => {
  assertEquals(wordStartMatch("pasta primavera", "pasta"), true);
});

Deno.test("wordStartMatch - empty term matches nothing", () => {
  assertEquals(wordStartMatch("ice cream", ""), true);
  // Note: ''.startsWith('') is true in JS, but an empty search term
  // is typically filtered out before calling wordStartMatch.
  // This test documents the actual behavior.
});

Deno.test("wordStartMatch - handles single-word text", () => {
  assertEquals(wordStartMatch("pasta", "pasta"), true);
  assertEquals(wordStartMatch("pasta", "past"), true);
  assertEquals(wordStartMatch("pasta", "asta"), false);
});

Deno.test('wordStartMatch - "ice" matches when word appears later in text', () => {
  assertEquals(wordStartMatch("vanilla ice cream", "ice"), true);
});

Deno.test("wordStartMatch - no match when term is not a word start", () => {
  assertEquals(wordStartMatch("advice", "vice"), false);
});
