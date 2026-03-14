/**
 * Spain Spanish (es-ES) Adapter
 *
 * Takes Mexican Spanish (es) content and produces Spain Spanish (es-ES)
 * overrides using a lightweight AI call. Only generates text that
 * actually differs from the Mexican variant.
 *
 * Uses gpt-4.1-nano since this is a simple terminology swap task.
 */

import { Logger } from './logger.ts';
import { parseJsonFromLLM } from './utils.ts';

const SYSTEM_PROMPT = `You adapt Mexican Spanish recipe text to Spain Spanish (Castilian).

Rules:
- ONLY change words/phrases that differ between Mexican and Spain Spanish
- Common swaps: jitomate→tomate, ejotes→judías verdes, chícharos→guisantes, papa→patata, durazno→melocotón, elote→maíz, betabel→remolacha, aguacate→aguacate (same), frijoles→alubias, chile→pimiento/guindilla, crema→nata, popote→pajita, refrigerador→frigorífico, estufa→cocina/fogón, sartén→sartén (same), vaso (Thermomix)→vaso (same)
- Keep Thermomix-specific terms unchanged (vaso, Varoma, vel, giro a la izquierda)
- Keep measurements unchanged (g, ml, min, seg)
- If the text is already neutral Spanish or doesn't need changes, return the EXACT same text
- Do NOT rewrite or rephrase — only swap region-specific words
- Return valid JSON matching the requested schema`;

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

  const result = parseJsonFromLLM(outputText) as SpainAdaptOutput;
  logger.info('Spain Spanish adaptation complete');
  return result;
}
