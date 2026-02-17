import { assertEquals } from 'std/assert/mod.ts';
import { allocateTranslationLimit } from './translation-limit.ts';

Deno.test('allocateTranslationLimit applies a single global cap across all buckets', () => {
  const result = allocateTranslationLimit(25, 25, 25, 20);

  assertEquals(result, {
    ingredientCount: 20,
    usefulItemCount: 0,
    tagCount: 0,
    total: 20,
  });
});

Deno.test('allocateTranslationLimit carries remaining budget to next bucket', () => {
  const result = allocateTranslationLimit(5, 12, 8, 10);

  assertEquals(result, {
    ingredientCount: 5,
    usefulItemCount: 5,
    tagCount: 0,
    total: 10,
  });
});

Deno.test('allocateTranslationLimit handles non-positive limits', () => {
  const result = allocateTranslationLimit(5, 12, 8, 0);

  assertEquals(result, {
    ingredientCount: 0,
    usefulItemCount: 0,
    tagCount: 0,
    total: 0,
  });
});
