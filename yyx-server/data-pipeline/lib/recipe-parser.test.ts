import { assertEquals, assertRejects } from 'std/assert/mod.ts';
import { enforceThermomixGate, type ParsedRecipeData, parseRecipe } from './recipe-parser.ts';
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
  kitchenTools: [
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
      thermomixMode: null,
      timerSeconds: null,
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
  plannerRole: null,
  equipmentTags: [],
  mealComponents: [],
  isCompleteMeal: false,
  cookingLevel: null,
  leftoversFriendly: null,
  maxHouseholdSizeSupported: null,
  batchFriendly: null,
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

Deno.test('parseRecipe parses fenced JSON from output_text', async () => {
  try {
    const json = JSON.stringify(baseRecipe, null, 2);
    mockOpenAIResponse({
      output_text: `\`\`\`json\n${json}\n\`\`\``,
    });

    const parsed = await parseRecipe('recipe markdown', 'test-key', mockLogger);

    assertEquals(parsed.nameEn, baseRecipe.nameEn);
    assertEquals(parsed.difficulty, 'easy');
    assertEquals(parsed.steps.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('parseRecipe parses nested content fallback', async () => {
  try {
    mockOpenAIResponse({
      output: [
        {
          content: [{ text: JSON.stringify(baseRecipe) }],
        },
      ],
    });

    const parsed = await parseRecipe('recipe markdown', 'test-key', mockLogger);
    assertEquals(parsed.nameEs, baseRecipe.nameEs);
    assertEquals(parsed.ingredients.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('parseRecipe throws on invalid JSON', async () => {
  try {
    mockOpenAIResponse({
      output_text: '```json\n{not-valid-json}\n```',
    });

    await assertRejects(
      () => parseRecipe('recipe markdown', 'test-key', mockLogger),
      Error,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('parseRecipe throws on schema mismatch', async () => {
  try {
    mockOpenAIResponse({
      output_text: JSON.stringify({
        ...baseRecipe,
        difficulty: 'expert',
      }),
    });

    await assertRejects(
      () => parseRecipe('recipe markdown', 'test-key', mockLogger),
      Error,
      '"difficulty" must be easy, medium, or hard',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('parseRecipe throws when response has no content', async () => {
  try {
    mockOpenAIResponse({
      output: [],
    });

    await assertRejects(
      () => parseRecipe('recipe markdown', 'test-key', mockLogger),
      Error,
      'No content in OpenAI response',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Locks in the contract that all meal-planning fields and step thermomix
// fields round-trip through validation. Catches type drift in
// ParsedRecipeData and silent removal of validator branches. Does not
// exercise the system prompt itself — that requires a live API call.
Deno.test('parseRecipe round-trips fully-populated meal-planning fields', async () => {
  try {
    const fullyPopulated: ParsedRecipeData = {
      ...baseRecipe,
      plannerRole: 'main',
      equipmentTags: ['thermomix', 'air_fryer'],
      mealComponents: ['protein', 'veg'],
      isCompleteMeal: true,
      cookingLevel: 'intermediate',
      leftoversFriendly: true,
      maxHouseholdSizeSupported: 6,
      batchFriendly: false,
      steps: [
        {
          ...baseRecipe.steps[0],
          thermomixMode: 'open_cooking',
          timerSeconds: 1800,
        },
      ],
    };
    mockOpenAIResponse({
      output_text: JSON.stringify(fullyPopulated),
    });

    const parsed = await parseRecipe('recipe markdown', 'test-key', mockLogger);

    assertEquals(parsed.plannerRole, 'main');
    assertEquals(parsed.equipmentTags, ['thermomix', 'air_fryer']);
    assertEquals(parsed.mealComponents, ['protein', 'veg']);
    assertEquals(parsed.isCompleteMeal, true);
    assertEquals(parsed.cookingLevel, 'intermediate');
    assertEquals(parsed.leftoversFriendly, true);
    assertEquals(parsed.maxHouseholdSizeSupported, 6);
    assertEquals(parsed.batchFriendly, false);
    assertEquals(parsed.steps[0].thermomixMode, 'open_cooking');
    assertEquals(parsed.steps[0].timerSeconds, 1800);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('parseRecipe rejects invalid plannerRole enum value', async () => {
  try {
    mockOpenAIResponse({
      output_text: JSON.stringify({ ...baseRecipe, plannerRole: 'breakfast' }),
    });

    await assertRejects(
      () => parseRecipe('recipe markdown', 'test-key', mockLogger),
      Error,
      '"plannerRole" must be one of',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Locks in the equipmentTags gate that prevents thermomix_* fields from
// leaking onto steps in non-Thermomix (e.g., air fryer, oven) recipes. The
// validators don't enforce this — the system prompt does — so this test
// confirms a payload with the gating already applied round-trips through
// the parser without the validators rejecting all-null thermomix_* fields.
Deno.test(
  'parseRecipe accepts non-Thermomix recipe with all step thermomix_* fields null',
  async () => {
    try {
      const airFryerRecipe: ParsedRecipeData = {
        ...baseRecipe,
        equipmentTags: ['air_fryer'],
        steps: [
          {
            ...baseRecipe.steps[0],
            instructionEn: 'Cook for 8 minutes at 190°C, then flip.',
            thermomixTime: null,
            thermomixTemperature: null,
            thermomixTemperatureUnit: null,
            thermomixSpeed: null,
            thermomixIsBladeReversed: null,
            thermomixMode: null,
            timerSeconds: 480,
          },
        ],
      };
      mockOpenAIResponse({
        output_text: JSON.stringify(airFryerRecipe),
      });

      const parsed = await parseRecipe('recipe markdown', 'test-key', mockLogger);

      assertEquals(parsed.equipmentTags, ['air_fryer']);
      assertEquals(parsed.steps[0].thermomixTime, null);
      assertEquals(parsed.steps[0].thermomixTemperature, null);
      assertEquals(parsed.steps[0].thermomixTemperatureUnit, null);
      assertEquals(parsed.steps[0].thermomixSpeed, null);
      assertEquals(parsed.steps[0].thermomixIsBladeReversed, null);
      assertEquals(parsed.steps[0].thermomixMode, null);
      assertEquals(parsed.steps[0].timerSeconds, 480);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

Deno.test('parseRecipe rejects invalid equipmentTags enum value', async () => {
  try {
    mockOpenAIResponse({
      output_text: JSON.stringify({ ...baseRecipe, equipmentTags: ['microwave'] }),
    });

    await assertRejects(
      () => parseRecipe('recipe markdown', 'test-key', mockLogger),
      Error,
      '"equipmentTags" contains invalid value "microwave"',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Defense-in-depth: even when the model violates the prompt and emits
// thermomix_* values for a non-Thermomix recipe, the post-validation
// normalization must scrub every step before the parsed result reaches
// the importer. This is the regression Codex flagged.
Deno.test(
  'parseRecipe scrubs thermomix_* fields when equipmentTags excludes thermomix',
  async () => {
    try {
      const pollutedFromModel = {
        ...baseRecipe,
        equipmentTags: ['air_fryer'],
        steps: [
          {
            ...baseRecipe.steps[0],
            order: 1,
            thermomixTime: 480,
            thermomixTemperature: 90,
            thermomixTemperatureUnit: 'C',
            thermomixSpeed: { type: 'single', value: 4, start: null, end: null },
            thermomixIsBladeReversed: true,
            thermomixMode: 'open_cooking',
            timerSeconds: 480,
          },
          {
            ...baseRecipe.steps[0],
            order: 2,
            thermomixTime: 600,
            thermomixTemperature: 'Varoma',
            thermomixTemperatureUnit: 'C',
            thermomixSpeed: null,
            thermomixIsBladeReversed: false,
            thermomixMode: null,
            timerSeconds: 600,
          },
        ],
      };
      mockOpenAIResponse({ output_text: JSON.stringify(pollutedFromModel) });

      const parsed = await parseRecipe('recipe markdown', 'test-key', mockLogger);

      assertEquals(parsed.equipmentTags, ['air_fryer']);
      for (const step of parsed.steps) {
        assertEquals(step.thermomixTime, null);
        assertEquals(step.thermomixTemperature, null);
        assertEquals(step.thermomixTemperatureUnit, null);
        assertEquals(step.thermomixSpeed, null);
        assertEquals(step.thermomixIsBladeReversed, null);
        assertEquals(step.thermomixMode, null);
      }
      // timerSeconds is preserved — it's the canonical signal for non-Thermomix durations.
      assertEquals(parsed.steps[0].timerSeconds, 480);
      assertEquals(parsed.steps[1].timerSeconds, 600);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

// Direct unit test on the helper, in case future callers use it independently
// from parseRecipe (e.g., a future admin import path that already has parsed data).
Deno.test('enforceThermomixGate leaves Thermomix recipes untouched', () => {
  const thermomixRecipe: ParsedRecipeData = {
    ...baseRecipe,
    equipmentTags: ['thermomix'],
    steps: [
      {
        ...baseRecipe.steps[0],
        thermomixTime: 600,
        thermomixTemperature: 90,
        thermomixTemperatureUnit: 'C',
        thermomixSpeed: { type: 'single', value: 'spoon', start: null, end: null },
        thermomixIsBladeReversed: true,
        thermomixMode: 'open_cooking',
        timerSeconds: null,
      },
    ],
  };

  const result = enforceThermomixGate(thermomixRecipe);

  assertEquals(result.steps[0].thermomixTime, 600);
  assertEquals(result.steps[0].thermomixTemperature, 90);
  assertEquals(result.steps[0].thermomixSpeed, {
    type: 'single',
    value: 'spoon',
    start: null,
    end: null,
  });
  assertEquals(result.steps[0].thermomixMode, 'open_cooking');
});
