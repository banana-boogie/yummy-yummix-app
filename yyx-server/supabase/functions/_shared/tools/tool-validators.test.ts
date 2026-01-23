import { assertEquals, assertThrows } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { ToolValidationError, validateSearchRecipesParams } from './tool-validators.ts';

Deno.test('validateSearchRecipesParams allows filter-only searches', () => {
  const params = validateSearchRecipesParams({ cuisine: 'Italian', maxTime: 30 });
  assertEquals(params.cuisine, 'Italian');
  assertEquals(params.maxTime, 30);
});

Deno.test('validateSearchRecipesParams rejects empty input', () => {
  assertThrows(
    () => validateSearchRecipesParams({}),
    ToolValidationError,
    'search_recipes requires a query or at least one filter',
  );
});

Deno.test('validateSearchRecipesParams sanitizes commas in query', () => {
  const params = validateSearchRecipesParams({ query: 'pasta, salad' });
  assertEquals(params.query?.includes(','), false);
});
