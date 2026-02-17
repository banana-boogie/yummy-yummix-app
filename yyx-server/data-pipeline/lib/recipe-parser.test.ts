import { assertEquals, assertRejects } from 'std/assert/mod.ts';
import { type ParsedRecipeData, parseRecipeMarkdown } from './recipe-parser.ts';
import type { Logger } from './logger.ts';

const mockLogger = {
  info: () => {},
  success: () => {},
} as unknown as Logger;

const baseRecipe: ParsedRecipeData = {
  nameEn: 'Tomato Soup',
  nameEs: 'Sopa de Tomate',
  totalTime: 30,
  prepTime: 10,
  difficulty: 'easy',
  portions: 4,
  tipsAndTricksEn: 'Serve warm',
  tipsAndTricksEs: 'Servir caliente',
  usefulItems: [
    {
      nameEn: 'Whisk',
      nameEs: 'Batidor',
      displayOrder: 1,
      notesEn: '',
      notesEs: '',
    },
  ],
  ingredients: [
    {
      ingredient: {
        nameEn: 'Tomato',
        nameEs: 'Tomate',
        pluralNameEn: 'Tomatoes',
        pluralNameEs: 'Tomates',
      },
      quantity: 2,
      measurementUnitID: 'unit',
      notesEn: '',
      notesEs: '',
      tipEn: '',
      tipEs: '',
      recipeSectionEn: 'Main',
      recipeSectionEs: 'Principal',
      displayOrder: 1,
    },
  ],
  steps: [
    {
      order: 1,
      instructionEn: 'Blend tomatoes.',
      instructionEs: 'Licua los tomates.',
      thermomixTime: null,
      thermomixTemperature: null,
      thermomixTemperatureUnit: null,
      thermomixSpeed: null,
      thermomixIsBladeReversed: null,
      ingredients: [
        {
          ingredient: {
            nameEn: 'Tomato',
            nameEs: 'Tomate',
            pluralNameEn: 'Tomatoes',
            pluralNameEs: 'Tomates',
          },
          quantity: 2,
          measurementUnitID: 'unit',
          displayOrder: 1,
        },
      ],
      tipEn: '',
      tipEs: '',
      recipeSectionEn: 'Main',
      recipeSectionEs: 'Principal',
    },
  ],
  tags: ['Soup'],
};

const originalFetch = globalThis.fetch;

function mockOpenAIResponse(payload: unknown): void {
  globalThis.fetch = (_input, _init) =>
    Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
}

Deno.test('parseRecipeMarkdown parses fenced JSON from output_text', async () => {
  try {
    const json = JSON.stringify(baseRecipe, null, 2);
    mockOpenAIResponse({
      output_text: `\`\`\`json\n${json}\n\`\`\``,
    });

    const parsed = await parseRecipeMarkdown('recipe markdown', 'test-key', mockLogger);

    assertEquals(parsed.nameEn, baseRecipe.nameEn);
    assertEquals(parsed.difficulty, 'easy');
    assertEquals(parsed.steps.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('parseRecipeMarkdown parses nested content fallback', async () => {
  try {
    mockOpenAIResponse({
      output: [
        {
          content: [{ text: JSON.stringify(baseRecipe) }],
        },
      ],
    });

    const parsed = await parseRecipeMarkdown('recipe markdown', 'test-key', mockLogger);
    assertEquals(parsed.nameEs, baseRecipe.nameEs);
    assertEquals(parsed.ingredients.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('parseRecipeMarkdown throws on invalid JSON', async () => {
  try {
    mockOpenAIResponse({
      output_text: '```json\n{not-valid-json}\n```',
    });

    await assertRejects(
      () => parseRecipeMarkdown('recipe markdown', 'test-key', mockLogger),
      Error,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('parseRecipeMarkdown throws on schema mismatch', async () => {
  try {
    mockOpenAIResponse({
      output_text: JSON.stringify({
        ...baseRecipe,
        difficulty: 'expert',
      }),
    });

    await assertRejects(
      () => parseRecipeMarkdown('recipe markdown', 'test-key', mockLogger),
      Error,
      '"difficulty" must be easy, medium, or hard',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('parseRecipeMarkdown throws when response has no content', async () => {
  try {
    mockOpenAIResponse({
      output: [],
    });

    await assertRejects(
      () => parseRecipeMarkdown('recipe markdown', 'test-key', mockLogger),
      Error,
      'No content in OpenAI response',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
