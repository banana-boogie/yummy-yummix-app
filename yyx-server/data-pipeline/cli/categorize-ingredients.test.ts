import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { categorizeBatch, type IngredientForLLM } from './categorize-ingredients.ts';
import type { CallOpenAIOptions } from '../lib/openai-client.ts';

const ingredients: IngredientForLLM[] = [
  { id: 'ing-1', name_en: 'Tomato', name_es: 'Jitomate' },
  { id: 'ing-2', name_en: 'Milk', name_es: 'Leche' },
  { id: 'ing-3', name_en: 'Mystery', name_es: 'Misterio' },
];

const logger = {
  warn: () => {},
} as never;

function mockCallOpenAI(content: string | null) {
  return (_options: CallOpenAIOptions) => Promise.resolve(content);
}

Deno.test('categorizeBatch returns valid assignments', async () => {
  const result = await categorizeBatch(ingredients, {
    logger,
    callOpenAI: mockCallOpenAI(JSON.stringify({
      assignments: [
        { id: 'ing-1', category_id: 'produce' },
        { id: 'ing-2', category_id: 'dairy' },
        { id: 'ing-3', category_id: 'other' },
      ],
    })),
  });

  assertEquals(result.get('ing-1'), 'produce');
  assertEquals(result.get('ing-2'), 'dairy');
  assertEquals(result.get('ing-3'), 'other');
});

Deno.test('categorizeBatch falls back to other for invalid and missing assignments', async () => {
  const result = await categorizeBatch(ingredients, {
    logger,
    callOpenAI: mockCallOpenAI(JSON.stringify({
      assignments: [
        { id: 'ing-1', category_id: 'not-a-category' },
        { id: 'ing-2', category_id: 'dairy' },
      ],
    })),
  });

  assertEquals(result.get('ing-1'), 'other');
  assertEquals(result.get('ing-2'), 'dairy');
  assertEquals(result.get('ing-3'), 'other');
});

Deno.test('categorizeBatch falls back to other when the model returns no content', async () => {
  const result = await categorizeBatch(ingredients, {
    logger,
    callOpenAI: mockCallOpenAI(null),
  });

  assertEquals(result.get('ing-1'), 'other');
  assertEquals(result.get('ing-2'), 'other');
  assertEquals(result.get('ing-3'), 'other');
});
