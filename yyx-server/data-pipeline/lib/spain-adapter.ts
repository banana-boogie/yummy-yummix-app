/**
 * Spain Spanish (es-ES) Adapter
 *
 * Takes Mexican Spanish (es) content and produces Spain Spanish (es-ES)
 * overrides using a lightweight AI call. Only generates text that
 * actually differs from the Mexican variant.
 *
 * Uses gpt-4.1-mini since this is a simple terminology swap task.
 */

import { Logger } from './logger.ts';
import { parseJsonFromLLM } from './utils.ts';
import { SPAIN_ADAPT_RULES } from './spain-constants.ts';

const SYSTEM_PROMPT = `You adapt Mexican Spanish recipe text to Spain Spanish (Castilian).

Rules:
${SPAIN_ADAPT_RULES}`;

interface SpainAdaptInput {
  recipeName?: string;
  tipsAndTricks?: string;
  steps?: Array<{ order: number; instruction: string; section: string; tip: string }>;
  ingredientNotes?: Array<{ displayOrder: number; notes: string; tip: string; section: string }>;
  newIngredients?: Array<{ name: string; pluralName: string }>;
  newKitchenTools?: Array<{ name: string }>;
}

export interface SpainAdaptOutput {
  recipeName?: string;
  tipsAndTricks?: string;
  steps?: Array<{ order: number; instruction: string; section: string; tip: string }>;
  ingredientNotes?: Array<{ displayOrder: number; notes: string; tip: string; section: string }>;
  newIngredients?: Array<{ name: string; pluralName: string }>;
  newKitchenTools?: Array<{ name: string }>;
}

const responseSchema = {
  type: 'object',
  properties: {
    recipeName: { type: 'string' },
    tipsAndTricks: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          order: { type: 'number' },
          instruction: { type: 'string' },
          section: { type: 'string' },
          tip: { type: 'string' },
        },
        required: ['order', 'instruction', 'section', 'tip'],
        additionalProperties: false,
      },
    },
    ingredientNotes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          displayOrder: { type: 'number' },
          notes: { type: 'string' },
          tip: { type: 'string' },
          section: { type: 'string' },
        },
        required: ['displayOrder', 'notes', 'tip', 'section'],
        additionalProperties: false,
      },
    },
    newIngredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          pluralName: { type: 'string' },
        },
        required: ['name', 'pluralName'],
        additionalProperties: false,
      },
    },
    newKitchenTools: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
      },
    },
  },
  required: ['recipeName', 'tipsAndTricks', 'steps', 'ingredientNotes', 'newIngredients', 'newKitchenTools'],
  additionalProperties: false,
};

// ─── Validation helpers (follow recipe-parser.ts pattern) ──

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

export function validateSpainAdaptOutput(data: unknown): asserts data is SpainAdaptOutput {
  if (!isObject(data)) {
    throw new Error('Invalid es-ES adaptation output: expected a JSON object');
  }
  if (data.recipeName !== undefined && !isString(data.recipeName)) {
    throw new Error('Invalid es-ES adaptation output: "recipeName" must be a string');
  }
  if (data.tipsAndTricks !== undefined && !isString(data.tipsAndTricks)) {
    throw new Error('Invalid es-ES adaptation output: "tipsAndTricks" must be a string');
  }
  if (data.steps !== undefined) {
    if (!Array.isArray(data.steps)) {
      throw new Error('Invalid es-ES adaptation output: "steps" must be an array');
    }
    for (const step of data.steps) {
      if (!isObject(step)) {
        throw new Error('Invalid es-ES adaptation output: step entries must be objects');
      }
      if (!isNumber(step.order)) {
        throw new Error('Invalid es-ES adaptation output: step "order" must be a number');
      }
      if (!isString(step.instruction)) {
        throw new Error('Invalid es-ES adaptation output: step "instruction" must be a string');
      }
    }
  }
  if (data.ingredientNotes !== undefined) {
    if (!Array.isArray(data.ingredientNotes)) {
      throw new Error('Invalid es-ES adaptation output: "ingredientNotes" must be an array');
    }
    for (const note of data.ingredientNotes) {
      if (!isObject(note)) {
        throw new Error('Invalid es-ES adaptation output: ingredientNote entries must be objects');
      }
      if (!isNumber(note.displayOrder)) {
        throw new Error(
          'Invalid es-ES adaptation output: ingredientNote "displayOrder" must be a number',
        );
      }
    }
  }
  if (data.newIngredients !== undefined) {
    if (!Array.isArray(data.newIngredients)) {
      throw new Error('Invalid es-ES adaptation output: "newIngredients" must be an array');
    }
    for (const ing of data.newIngredients) {
      if (!isObject(ing) || !isString(ing.name) || !isString(ing.pluralName)) {
        throw new Error(
          'Invalid es-ES adaptation output: newIngredient entries must have "name" and "pluralName" strings',
        );
      }
    }
  }
  if (data.newKitchenTools !== undefined) {
    if (!Array.isArray(data.newKitchenTools)) {
      throw new Error('Invalid es-ES adaptation output: "newKitchenTools" must be an array');
    }
    for (const kt of data.newKitchenTools) {
      if (!isObject(kt) || !isString(kt.name)) {
        throw new Error(
          'Invalid es-ES adaptation output: newKitchenTool entries must have a "name" string',
        );
      }
    }
  }
}

/**
 * Adapt Mexican Spanish content to Spain Spanish.
 * Makes a single AI call with all translatable text bundled together.
 * Returns the adapted text — only words that differ will be changed.
 */
export async function adaptToSpainSpanish(
  input: SpainAdaptInput,
  openaiApiKey: string,
  logger: Logger,
): Promise<SpainAdaptOutput> {
  logger.info('Adapting to Spain Spanish (es-ES)...');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.1,
      max_output_tokens: 8000,
      text: {
        format: {
          type: 'json_schema',
          name: 'SpainSpanishAdapt',
          schema: responseSchema,
        },
      },
      input: JSON.stringify(input),
      instructions: SYSTEM_PROMPT,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error for es-ES adaptation (${response.status}): ${errorText}`);
  }

  const responseData = await response.json();
  const outputText = responseData.output_text ||
    responseData.output?.[0]?.content?.[0]?.text;

  if (!outputText) {
    throw new Error('No content in OpenAI response for es-ES adaptation');
  }

  const result = parseJsonFromLLM(outputText);
  validateSpainAdaptOutput(result);
  logger.info('Spain Spanish adaptation complete');
  return result;
}
