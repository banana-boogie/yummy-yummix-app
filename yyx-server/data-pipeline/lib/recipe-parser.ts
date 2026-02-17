/**
 * Recipe Parser
 *
 * Parses bilingual recipe markdown using OpenAI GPT-4o-mini with structured output.
 * Uses the same JSON schema as the parse-recipe-markdown edge function.
 */

import { Logger } from './logger.ts';
import { parseJsonFromLLM } from './utils.ts';

// Shared speed enum used in multiple places
const speedEnum = [
  'spoon',
  0.5,
  1,
  1.5,
  2,
  2.5,
  3,
  3.5,
  4,
  4.5,
  5,
  5.5,
  6,
  6.5,
  7,
  7.5,
  8,
  8.5,
  9,
  9.5,
  10,
  null,
];

const temperatureEnum = [
  37,
  40,
  45,
  50,
  55,
  60,
  65,
  70,
  75,
  80,
  85,
  90,
  95,
  98,
  100,
  105,
  110,
  115,
  120,
  'Varoma',
  130,
  140,
  150,
  160,
  170,
  175,
  185,
  195,
  200,
  205,
  212,
  220,
  230,
  240,
  250,
  null,
];

const measurementUnitEnum = [
  'clove',
  'cup',
  'g',
  'kg',
  'l',
  'lb',
  'leaf',
  'ml',
  'oz',
  'piece',
  'pinch',
  'slice',
  'sprig',
  'taste',
  'tbsp',
  'tsp',
  'unit',
];

/** JSON Schema for OpenAI structured output - mirrors edge function */
const recipeJsonSchema = {
  name: 'recipe',
  schema: {
    type: 'object',
    properties: {
      nameEn: { type: 'string', description: 'English recipe name' },
      nameEs: { type: 'string', description: 'Spanish recipe name.' },
      totalTime: { type: 'number', description: 'Total time required to make the recipe.' },
      prepTime: { type: 'number', description: 'Preparation time needed before cooking.' },
      difficulty: {
        type: 'string',
        description: 'Difficulty level of the recipe in English',
        enum: ['easy', 'medium', 'hard'],
      },
      portions: { type: 'number', description: 'Number of portions the recipe makes.' },
      tipsAndTricksEn: { type: 'string', description: 'English tips section.' },
      tipsAndTricksEs: { type: 'string', description: 'Spanish tips section.' },
      usefulItems: {
        type: 'array',
        description:
          'List of the useful items for the recipe found in the Utensilios y herramientas utiles or Useful tools and utensils section.',
        items: {
          type: 'object',
          properties: {
            nameEn: { type: 'string', description: 'English useful tool name.' },
            nameEs: { type: 'string', description: 'Spanish useful tool name.' },
            displayOrder: {
              type: 'number',
              description: '1-based index indicating the order of the useful item.',
            },
            notesEn: {
              type: 'string',
              description: 'Additional notes about the useful item in English.',
            },
            notesEs: {
              type: 'string',
              description: 'Additional notes about the useful item in Spanish.',
            },
          },
          required: ['nameEn', 'nameEs', 'displayOrder', 'notesEn', 'notesEs'],
          additionalProperties: false,
        },
      },
      ingredients: {
        type: 'array',
        description: 'List of the ingredients required for the recipe.',
        items: {
          type: 'object',
          properties: {
            ingredient: {
              type: 'object',
              description: 'Ingredient details',
              properties: {
                nameEn: {
                  type: 'string',
                  description:
                    'Only the ingredient name (in English.), no quantities, no adjectives, no descriptions, or notes.',
                },
                pluralNameEn: {
                  type: 'string',
                  description:
                    'Only the plural ingredient name (in English.), no quantities, no adjectives, no descriptions, or notes.',
                },
                nameEs: {
                  type: 'string',
                  description:
                    'Only the ingredient name (in Spanish), no quantities, no adjectives, no descriptions, or notes.',
                },
                pluralNameEs: {
                  type: 'string',
                  description:
                    'Only the plural ingredient name (in Spanish), no quantities, no adjectives, no descriptions, or notes.',
                },
              },
              required: ['nameEn', 'nameEs', 'pluralNameEn', 'pluralNameEs'],
              additionalProperties: false,
            },
            quantity: { type: 'number', description: 'Quantity of the ingredient.' },
            measurementUnitID: {
              type: 'string',
              description: 'The measurement unit of the ingredient if any.',
              enum: measurementUnitEnum,
              default: 'unit',
            },
            notesEn: {
              type: 'string',
              description: 'Any additional preparation notes in English.',
            },
            notesEs: {
              type: 'string',
              description: 'Any additional preparation notes in Spanish.',
            },
            tipEn: {
              type: 'string',
              description: 'Any tip included in the ingredient in English.',
            },
            tipEs: {
              type: 'string',
              description: 'Any tip included in the ingredient in Spanish.',
            },
            recipeSectionEn: {
              type: 'string',
              description:
                'If the recipe has multiple components, the title of section if found, otherwise: Main',
            },
            recipeSectionEs: {
              type: 'string',
              description:
                'If the recipe has multiple components, the title of section if found, otherwise: Principal',
            },
            displayOrder: {
              type: 'number',
              description: '1-based index indicating the order of the ingredient.',
            },
          },
          required: [
            'quantity',
            'measurementUnitID',
            'ingredient',
            'notesEn',
            'notesEs',
            'tipEn',
            'tipEs',
            'recipeSectionEn',
            'recipeSectionEs',
            'displayOrder',
          ],
          additionalProperties: false,
        },
      },
      steps: {
        type: 'array',
        description: 'List of steps.',
        items: {
          type: 'object',
          properties: {
            order: {
              type: 'number',
              description: '1-based index indicating the order of the instruction.',
            },
            instructionEn: { type: 'string', description: 'Full instruction text in English.' },
            instructionEs: { type: 'string', description: 'Full instruction text in Spanish.' },
            thermomixTime: {
              type: ['number', 'null'],
              description: 'Time in seconds, extracted from thermomix patterns.',
            },
            thermomixTemperature: {
              type: ['number', 'string', 'null'],
              description: 'Temperature extracted from thermomix patterns. Null if not found.',
              enum: temperatureEnum,
            },
            thermomixTemperatureUnit: {
              type: ['string', 'null'],
              description: 'Temperature unit in C or F, if it exists, null otherwise',
              enum: ['C', 'F', null],
            },
            thermomixSpeed: {
              type: ['object', 'null'],
              description: 'Speed section extracted from thermomix patterns.',
              properties: {
                type: {
                  type: 'string',
                  enum: ['single', 'range'],
                  description: "Type of speed, either 'single' or 'range'.",
                },
                value: {
                  type: ['number', 'string', 'null'],
                  enum: speedEnum,
                  description: 'Speed value for single type, null for range.',
                },
                start: {
                  type: ['number', 'string', 'null'],
                  enum: speedEnum,
                  description: 'Start value for range type, null for single.',
                },
                end: {
                  type: ['number', 'string', 'null'],
                  enum: speedEnum,
                  description: 'End value for range type, null for single.',
                },
              },
              required: ['type', 'value', 'start', 'end'],
              additionalProperties: false,
            },
            thermomixIsBladeReversed: {
              type: ['boolean', 'null'],
              description: 'Reverse blade extracted from thermomix patterns.',
            },
            ingredients: {
              type: 'array',
              description: 'List of ingredients used in this step.',
              items: {
                type: 'object',
                properties: {
                  ingredient: {
                    type: 'object',
                    description: 'Ingredient details',
                    properties: {
                      nameEn: {
                        type: 'string',
                        description: 'Only the ingredient name (in English.)',
                      },
                      pluralNameEn: {
                        type: 'string',
                        description: 'Only the plural ingredient name (in English.)',
                      },
                      nameEs: {
                        type: 'string',
                        description: 'Only the ingredient name (in Spanish)',
                      },
                      pluralNameEs: {
                        type: 'string',
                        description: 'Only the plural ingredient name (in Spanish)',
                      },
                    },
                    required: ['nameEn', 'nameEs', 'pluralNameEn', 'pluralNameEs'],
                    additionalProperties: false,
                  },
                  quantity: { type: 'number', description: 'Quantity of the ingredient.' },
                  measurementUnitID: {
                    type: 'string',
                    description: 'The measurement unit.',
                    enum: measurementUnitEnum,
                    default: 'unit',
                  },
                  displayOrder: {
                    type: 'number',
                    description: '1-based index of the ingredient in this step.',
                  },
                },
                required: ['ingredient', 'quantity', 'measurementUnitID', 'displayOrder'],
                additionalProperties: false,
              },
            },
            tipEn: { type: 'string', description: 'Tip for this recipe step in English.' },
            tipEs: { type: 'string', description: 'Tip for this recipe step in Spanish.' },
            recipeSectionEn: {
              type: 'string',
              description: 'Section title in English, default: Main',
            },
            recipeSectionEs: {
              type: 'string',
              description: 'Section title in Spanish, default: Principal',
            },
          },
          required: [
            'order',
            'thermomixTime',
            'thermomixTemperature',
            'thermomixTemperatureUnit',
            'thermomixSpeed',
            'thermomixIsBladeReversed',
            'ingredients',
            'instructionEn',
            'instructionEs',
            'tipEn',
            'tipEs',
            'recipeSectionEn',
            'recipeSectionEs',
          ],
          additionalProperties: false,
        },
      },
      tags: {
        type: 'array',
        description: 'List of all tags from both English and Spanish sections.',
        items: { type: 'string', description: 'Tag name without # prefix.' },
      },
    },
    required: [
      'nameEn',
      'nameEs',
      'totalTime',
      'prepTime',
      'difficulty',
      'portions',
      'tipsAndTricksEn',
      'tipsAndTricksEs',
      'usefulItems',
      'ingredients',
      'steps',
      'tags',
    ],
    additionalProperties: false,
  },
  strict: true,
};

const systemPrompt = `
You are a recipe parser specializing in converting Markdown recipes into structured JSON data.

You will receive data about a recipe, the recipe comes in two languages English and Spanish.
In the Spanish section of the recipe, it is structured into different parts: Ingredientes, Procedimiento, Tips, Utensilios y herramientas útiles, Tags.
In the English section of the recipe, it is structured into different parts: Ingredients, Instructions (a.k.a. steps), Tips, Useful tools and utensils, Tags.

For Thermomix instructions, extract the Thermomix parameters from patterns like "(40 sec/reverse blades/speed 3)" or "(45 sec/speed 3)".

DO NOT make up any information.
DO NOT include any information that is not found in the recipe.
DO NOT include ingredients that are not found in the recipe.
DO NOT include useful items that are not found in the recipe.
DO NOT include tags that are not found in the recipe.
DO NOT include tips that are not found in the recipe.
DO NOT include steps that are not found in the recipe.
`;

export interface ParsedRecipeData {
  nameEn: string;
  nameEs: string;
  totalTime: number;
  prepTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  portions: number;
  tipsAndTricksEn: string;
  tipsAndTricksEs: string;
  usefulItems: Array<{
    nameEn: string;
    nameEs: string;
    displayOrder: number;
    notesEn: string;
    notesEs: string;
  }>;
  ingredients: Array<{
    ingredient: {
      nameEn: string;
      nameEs: string;
      pluralNameEn: string;
      pluralNameEs: string;
    };
    quantity: number;
    measurementUnitID: string;
    notesEn: string;
    notesEs: string;
    tipEn: string;
    tipEs: string;
    recipeSectionEn: string;
    recipeSectionEs: string;
    displayOrder: number;
  }>;
  steps: Array<{
    order: number;
    instructionEn: string;
    instructionEs: string;
    thermomixTime: number | null;
    thermomixTemperature: number | string | null;
    thermomixTemperatureUnit: string | null;
    thermomixSpeed: {
      type: 'single' | 'range';
      value: number | string | null;
      start: number | string | null;
      end: number | string | null;
    } | null;
    thermomixIsBladeReversed: boolean | null;
    ingredients: Array<{
      ingredient: {
        nameEn: string;
        nameEs: string;
        pluralNameEn: string;
        pluralNameEs: string;
      };
      quantity: number;
      measurementUnitID: string;
      displayOrder: number;
    }>;
    tipEn: string;
    tipEs: string;
    recipeSectionEn: string;
    recipeSectionEs: string;
  }>;
  tags: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || isNumber(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isDifficulty(value: unknown): value is ParsedRecipeData['difficulty'] {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

function getField(obj: Record<string, unknown>, key: string): unknown {
  return obj[key];
}

function assertStringField(obj: Record<string, unknown>, key: string): void {
  if (!isString(getField(obj, key))) {
    throw new Error(`Invalid recipe parser output: "${key}" must be a string`);
  }
}

function assertNumberField(obj: Record<string, unknown>, key: string): void {
  if (!isNumber(getField(obj, key))) {
    throw new Error(`Invalid recipe parser output: "${key}" must be a number`);
  }
}

function assertArrayField(obj: Record<string, unknown>, key: string): unknown[] {
  const value = getField(obj, key);
  if (!Array.isArray(value)) {
    throw new Error(`Invalid recipe parser output: "${key}" must be an array`);
  }
  return value;
}

function validateUsefulItems(usefulItems: unknown[]): void {
  for (const item of usefulItems) {
    if (!isObject(item)) {
      throw new Error('Invalid recipe parser output: "usefulItems" entries must be objects');
    }
    assertStringField(item, 'nameEn');
    assertStringField(item, 'nameEs');
    assertNumberField(item, 'displayOrder');
    assertStringField(item, 'notesEn');
    assertStringField(item, 'notesEs');
  }
}

function validateIngredientRef(value: unknown, sourceField: string): void {
  if (!isObject(value)) {
    throw new Error(`Invalid recipe parser output: "${sourceField}.ingredient" must be an object`);
  }
  assertStringField(value, 'nameEn');
  assertStringField(value, 'nameEs');
  assertStringField(value, 'pluralNameEn');
  assertStringField(value, 'pluralNameEs');
}

function validateIngredients(ingredients: unknown[]): void {
  for (const ingredient of ingredients) {
    if (!isObject(ingredient)) {
      throw new Error('Invalid recipe parser output: "ingredients" entries must be objects');
    }
    validateIngredientRef(getField(ingredient, 'ingredient'), 'ingredients');
    assertNumberField(ingredient, 'quantity');
    assertStringField(ingredient, 'measurementUnitID');
    assertStringField(ingredient, 'notesEn');
    assertStringField(ingredient, 'notesEs');
    assertStringField(ingredient, 'tipEn');
    assertStringField(ingredient, 'tipEs');
    assertStringField(ingredient, 'recipeSectionEn');
    assertStringField(ingredient, 'recipeSectionEs');
    assertNumberField(ingredient, 'displayOrder');
  }
}

function validateStepSpeed(step: Record<string, unknown>): void {
  const speed = getField(step, 'thermomixSpeed');
  if (speed === null) {
    return;
  }
  if (!isObject(speed)) {
    throw new Error('Invalid recipe parser output: "thermomixSpeed" must be an object or null');
  }

  const speedType = getField(speed, 'type');
  if (speedType !== 'single' && speedType !== 'range') {
    throw new Error('Invalid recipe parser output: "thermomixSpeed.type" must be single or range');
  }

  const value = getField(speed, 'value');
  const start = getField(speed, 'start');
  const end = getField(speed, 'end');
  if (!isNumberOrNull(value) && !isStringOrNull(value)) {
    throw new Error('Invalid recipe parser output: "thermomixSpeed.value" has invalid type');
  }
  if (!isNumberOrNull(start) && !isStringOrNull(start)) {
    throw new Error('Invalid recipe parser output: "thermomixSpeed.start" has invalid type');
  }
  if (!isNumberOrNull(end) && !isStringOrNull(end)) {
    throw new Error('Invalid recipe parser output: "thermomixSpeed.end" has invalid type');
  }
}

function validateStepIngredients(step: Record<string, unknown>): void {
  const stepIngredients = assertArrayField(step, 'ingredients');
  for (const ingredient of stepIngredients) {
    if (!isObject(ingredient)) {
      throw new Error('Invalid recipe parser output: step ingredient entries must be objects');
    }
    validateIngredientRef(getField(ingredient, 'ingredient'), 'steps[].ingredients');
    assertNumberField(ingredient, 'quantity');
    assertStringField(ingredient, 'measurementUnitID');
    assertNumberField(ingredient, 'displayOrder');
  }
}

function validateSteps(steps: unknown[]): void {
  for (const step of steps) {
    if (!isObject(step)) {
      throw new Error('Invalid recipe parser output: "steps" entries must be objects');
    }
    assertNumberField(step, 'order');
    assertStringField(step, 'instructionEn');
    assertStringField(step, 'instructionEs');
    assertStringField(step, 'tipEn');
    assertStringField(step, 'tipEs');
    assertStringField(step, 'recipeSectionEn');
    assertStringField(step, 'recipeSectionEs');

    if (!isNumberOrNull(getField(step, 'thermomixTime'))) {
      throw new Error('Invalid recipe parser output: "thermomixTime" must be a number or null');
    }

    const temperature = getField(step, 'thermomixTemperature');
    if (!isNumberOrNull(temperature) && !isStringOrNull(temperature)) {
      throw new Error(
        'Invalid recipe parser output: "thermomixTemperature" must be a number, string, or null',
      );
    }

    const temperatureUnit = getField(step, 'thermomixTemperatureUnit');
    if (!isStringOrNull(temperatureUnit)) {
      throw new Error(
        'Invalid recipe parser output: "thermomixTemperatureUnit" must be a string or null',
      );
    }

    const bladeReversed = getField(step, 'thermomixIsBladeReversed');
    if (bladeReversed !== null && typeof bladeReversed !== 'boolean') {
      throw new Error(
        'Invalid recipe parser output: "thermomixIsBladeReversed" must be a boolean or null',
      );
    }

    validateStepSpeed(step);
    validateStepIngredients(step);
  }
}

function validateTags(tags: unknown[]): void {
  for (const tag of tags) {
    if (!isString(tag)) {
      throw new Error('Invalid recipe parser output: all "tags" must be strings');
    }
  }
}

function validateParsedRecipeData(data: unknown): ParsedRecipeData {
  if (!isObject(data)) {
    throw new Error('Invalid recipe parser output: expected a JSON object');
  }

  assertStringField(data, 'nameEn');
  assertStringField(data, 'nameEs');
  assertNumberField(data, 'totalTime');
  assertNumberField(data, 'prepTime');
  assertNumberField(data, 'portions');
  assertStringField(data, 'tipsAndTricksEn');
  assertStringField(data, 'tipsAndTricksEs');

  if (!isDifficulty(getField(data, 'difficulty'))) {
    throw new Error('Invalid recipe parser output: "difficulty" must be easy, medium, or hard');
  }

  const usefulItems = assertArrayField(data, 'usefulItems');
  const ingredients = assertArrayField(data, 'ingredients');
  const steps = assertArrayField(data, 'steps');
  const tags = assertArrayField(data, 'tags');

  validateUsefulItems(usefulItems);
  validateIngredients(ingredients);
  validateSteps(steps);
  validateTags(tags);

  return data as unknown as ParsedRecipeData;
}

function extractContentText(responseData: unknown): string | null {
  if (!isObject(responseData)) {
    return null;
  }

  const outputText = getField(responseData, 'output_text');
  if (isString(outputText) && outputText.trim()) {
    return outputText;
  }

  const output = getField(responseData, 'output');
  if (!Array.isArray(output)) {
    return null;
  }

  for (const outputEntry of output) {
    if (!isObject(outputEntry)) {
      continue;
    }

    const content = getField(outputEntry, 'content');
    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (!isObject(part)) {
        continue;
      }
      const text = getField(part, 'text');
      if (isString(text) && text.trim()) {
        return text;
      }
    }
  }

  return null;
}

/** Parse a recipe markdown file using OpenAI structured output */
export async function parseRecipeMarkdown(
  markdown: string,
  openaiApiKey: string,
  logger: Logger,
): Promise<ParsedRecipeData> {
  logger.info('Calling OpenAI to parse recipe markdown...');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_output_tokens: 10000,
      text: {
        format: {
          type: 'json_schema',
          name: 'ParseRecipe',
          schema: recipeJsonSchema.schema,
        },
      },
      input: markdown,
      instructions: systemPrompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const responseData = await response.json();
  const content = extractContentText(responseData);

  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  const parsed = validateParsedRecipeData(parseJsonFromLLM(content));
  logger.success(`Parsed recipe: "${parsed.nameEn}" / "${parsed.nameEs}"`);
  return parsed;
}
