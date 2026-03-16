import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  detectTextToolCall,
  StreamingToolCallFilter,
  stripToolCallText,
} from './tool-call-text.ts';

// ============================================================
// StreamingToolCallFilter
// ============================================================

Deno.test('StreamingToolCallFilter: normal tokens pass through immediately', () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  filter.push('Hello');
  filter.push(' world');
  filter.push('!');
  filter.end();

  assertEquals(output, ['Hello', ' world', '!']);
});

Deno.test('StreamingToolCallFilter: suppresses call:search_recipes{...}', () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  filter.push('Here are some recipes');
  filter.push('\ncall:search_recipes');
  filter.push('{"query":"pasta"}');
  filter.end();

  assertEquals(output, ['Here are some recipes']);
});

Deno.test('StreamingToolCallFilter: suppresses search_recipes{...} at token start', () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  filter.push('search_recipes');
  filter.push('{"query":"tacos"}');
  filter.end();

  assertEquals(output, []);
});

Deno.test('StreamingToolCallFilter: suppresses generate_custom_recipe{...}', () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  filter.push('generate_custom_recipe');
  filter.push('{"recipeDescription":"a cake"}');
  filter.end();

  assertEquals(output, []);
});

Deno.test('StreamingToolCallFilter: suppresses <tool_calls> XML pattern', () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  filter.push('<tool_calls>');
  filter.push('<call name="search_recipes">');
  filter.end();

  assertEquals(output, []);
});

Deno.test('StreamingToolCallFilter: suppresses JSON object with known keys', () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  filter.push('{"query":');
  filter.push('"pasta"}');
  filter.end();

  assertEquals(output, []);
});

Deno.test('StreamingToolCallFilter: flushes false positive < token', () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  // A '<' that is just a comparison, not a tool call
  filter.push('<');
  filter.push('3 I love cooking');
  // After accumulating "<3 I love cooking" (17 chars), still under MAX_BUFFER
  // but no suppress pattern matches, so keep buffering until end()
  filter.end();

  // end() should flush because no suppress pattern matched
  assertEquals(output.join(''), '<3 I love cooking');
});

Deno.test('StreamingToolCallFilter: flushes large false positive buffer', () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  // Start with '{' at stream start (charsFlushed=0) which triggers buffering
  filter.push('{');
  const padding = 'a'.repeat(101);
  filter.push(padding);
  filter.end();

  // Should have flushed once buffer exceeded MAX_BUFFER
  const combined = output.join('');
  assertEquals(combined, '{' + padding);
});

Deno.test('StreamingToolCallFilter: disabled mode passes everything through', () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text), true);

  filter.push('search_recipes');
  filter.push('{"query":"tacos"}');
  filter.end();

  assertEquals(output, ['search_recipes', '{"query":"tacos"}']);
});

Deno.test('StreamingToolCallFilter: abort discards buffer', () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  filter.push('Normal text');
  filter.push('\n{"query":');
  filter.push('partial');
  filter.abort();

  // Only the normal text passed through before buffering started
  assertEquals(output, ['Normal text']);
});

Deno.test('StreamingToolCallFilter: mid-stream { passes through (not buffered)', () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  filter.push('Use {ingredient} for best results');

  assertEquals(output, ['Use {ingredient} for best results']);
});

Deno.test('StreamingToolCallFilter: mixed content with tool call at end', () => {
  const output: string[] = [];
  const filter = new StreamingToolCallFilter((text) => output.push(text));

  filter.push('Let me search ');
  filter.push('for that. ');
  filter.push('\ncall:search_recipes');
  filter.push('{"query":"enchiladas"}');
  filter.end();

  assertEquals(output, ['Let me search ', 'for that. ']);
});

// ============================================================
// Existing function tests (regression)
// ============================================================

Deno.test('detectTextToolCall: detects call:search_recipes', () => {
  const result = detectTextToolCall('Let me call:search_recipes{"query":"test"}');
  assertEquals(result, 'search_recipes');
});

Deno.test('detectTextToolCall: detects generate_custom_recipe{', () => {
  const result = detectTextToolCall('generate_custom_recipe{"recipeDescription":"cake"}');
  assertEquals(result, 'generate_custom_recipe');
});

Deno.test('detectTextToolCall: returns null for normal text', () => {
  const result = detectTextToolCall('Here are some recipe ideas for you!');
  assertEquals(result, null);
});

Deno.test('stripToolCallText: removes trailing tool call text', () => {
  const input = 'Here is my response\ncall:search_recipes{"query":"tacos"}';
  const result = stripToolCallText(input);
  assertEquals(result, 'Here is my response');
});

Deno.test('stripToolCallText: preserves clean text', () => {
  const result = stripToolCallText('Just a normal message');
  assertEquals(result, 'Just a normal message');
});
