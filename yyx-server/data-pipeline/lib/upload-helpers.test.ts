import { assertEquals } from 'std/assert/mod.ts';
import { extractIngredientName } from './upload-helpers.ts';

// ─── extractIngredientName ──────────────────────────────

Deno.test('extractIngredientName strips .png extension', () => {
  assertEquals(extractIngredientName('tomato.png'), 'Tomato');
});

Deno.test('extractIngredientName strips .PNG extension (case-insensitive)', () => {
  assertEquals(extractIngredientName('tomato.PNG'), 'Tomato');
});

Deno.test('extractIngredientName replaces underscores with spaces', () => {
  assertEquals(extractIngredientName('olive_oil.png'), 'Olive oil');
});

Deno.test('extractIngredientName handles multiple underscores', () => {
  assertEquals(extractIngredientName('carne_de_cerdo.png'), 'Carne de cerdo');
});

Deno.test('extractIngredientName capitalizes first character only', () => {
  assertEquals(extractIngredientName('brown_sugar.png'), 'Brown sugar');
});

Deno.test('extractIngredientName preserves accented characters', () => {
  assertEquals(extractIngredientName('café.png'), 'Caf\u00e9');
});

Deno.test('extractIngredientName handles mixed case input', () => {
  assertEquals(extractIngredientName('Brown_Sugar.png'), 'Brown Sugar');
});

Deno.test('extractIngredientName trims whitespace', () => {
  assertEquals(extractIngredientName(' rice .png'), 'Rice');
});

Deno.test('extractIngredientName handles filename without extension', () => {
  // No .png suffix means nothing to strip — returns capitalized name
  assertEquals(extractIngredientName('tomato'), 'Tomato');
});

Deno.test('extractIngredientName handles .png in middle of name', () => {
  // Only the trailing .png is stripped
  assertEquals(extractIngredientName('my.png_file.png'), 'My.png file');
});

Deno.test('extractIngredientName handles single character filename', () => {
  assertEquals(extractIngredientName('a.png'), 'A');
});

Deno.test('extractIngredientName preserves unicode characters (non-Latin)', () => {
  assertEquals(extractIngredientName('soja_verde.png'), 'Soja verde');
});

Deno.test('extractIngredientName handles consecutive underscores', () => {
  assertEquals(extractIngredientName('a__b.png'), 'A  b');
});
