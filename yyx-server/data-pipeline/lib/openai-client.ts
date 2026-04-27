/**
 * Shared OpenAI Client
 *
 * Provides a generic retry-with-backoff wrapper for OpenAI chat completions,
 * plus a convenience function for nutrition lookups. Centralizes transient
 * error detection, exponential backoff, and response parsing so individual
 * CLI scripts don't duplicate this logic.
 */

import { Logger } from './logger.ts';
import { sleep } from './utils.ts';

export interface CallOpenAIOptions {
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  logger: Logger;
  /** Label used in log messages (e.g. ingredient name). */
  label?: string;
  /** Maximum retry attempts (default: 3). */
  maxAttempts?: number;
  /** Base backoff in ms before exponential increase (default: 1000). */
  baseBackoffMs?: number;
}

/**
 * Call the OpenAI chat completions API with retry and exponential backoff.
 *
 * Retries on transient errors (HTTP 429 rate-limit and 5xx server errors).
 * Returns the `content` string from the first choice's message, or `null`
 * if the request ultimately fails or returns no content.
 */
export async function callOpenAI(options: CallOpenAIOptions): Promise<string | null> {
  const {
    apiKey,
    model,
    messages,
    temperature = 0.3,
    logger,
    label = '',
    maxAttempts = 3,
    baseBackoffMs = 1000,
  } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, temperature }),
      });

      if (!res.ok) {
        const body = await res.text();
        const retryable = res.status === 429 || res.status >= 500;
        if (retryable && attempt < maxAttempts) {
          const backoffMs = baseBackoffMs * (2 ** (attempt - 1));
          logger.warn(
            `OpenAI transient error${label ? ` for "${label}"` : ''} (attempt ${attempt}/${maxAttempts}, status ${res.status}). Retrying in ${backoffMs}ms...`,
          );
          await sleep(backoffMs);
          continue;
        }
        throw new Error(`OpenAI API error (${res.status}): ${body}`);
      }

      const data = await res.json();
      const content: string | undefined = data.choices?.[0]?.message?.content;
      return content ?? null;
    } catch (error) {
      if (attempt < maxAttempts) {
        const backoffMs = baseBackoffMs * (2 ** (attempt - 1));
        logger.warn(
          `OpenAI call failed${label ? ` for "${label}"` : ''} (attempt ${attempt}/${maxAttempts}): ${error}. Retrying in ${backoffMs}ms...`,
        );
        await sleep(backoffMs);
        continue;
      }
      logger.warn(`OpenAI error${label ? ` for "${label}"` : ''}: ${error}`);
      return null;
    }
  }

  return null;
}

// ─── Nutrition convenience function ────────────────────

export interface NutritionData {
  calories: number;
  protein: number;
  fat: number;
  carbohydrates: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

/**
 * Fetch nutritional facts per 100g for an ingredient using OpenAI.
 *
 * Returns parsed and rounded nutrition data, or `null` on failure.
 */
export async function fetchNutritionFromOpenAI(
  ingredientName: string,
  apiKey: string,
  logger: Logger,
): Promise<NutritionData | null> {
  const { parseJsonFromLLM } = await import('./utils.ts');

  const content = await callOpenAI({
    apiKey,
    model: 'gpt-4.1-mini',
    messages: [{
      role: 'user',
      content:
        `Provide nutritional facts per 100g for raw/unprocessed "${ingredientName}". Use USDA reference values. Units: calories in kcal; protein, fat, carbohydrates, fiber, sugar in grams; sodium in milligrams. Return ONLY a JSON object in this exact format: {"calories": number, "protein": number, "fat": number, "carbohydrates": number, "fiber": number, "sugar": number, "sodium": number}`,
    }],
    temperature: 0.3,
    logger,
    label: ingredientName,
  });

  if (!content) return null;

  try {
    const nutrition = parseJsonFromLLM(content) as Record<string, unknown> | null;
    if (
      !nutrition ||
      typeof nutrition.calories !== 'number' ||
      typeof nutrition.protein !== 'number' ||
      typeof nutrition.fat !== 'number' ||
      typeof nutrition.carbohydrates !== 'number' ||
      typeof nutrition.fiber !== 'number' ||
      typeof nutrition.sugar !== 'number' ||
      typeof nutrition.sodium !== 'number'
    ) return null;

    return {
      calories: Math.round(nutrition.calories),
      protein: Math.round(nutrition.protein * 10) / 10,
      fat: Math.round(nutrition.fat * 10) / 10,
      carbohydrates: Math.round(nutrition.carbohydrates * 10) / 10,
      fiber: Math.round(nutrition.fiber * 10) / 10,
      sugar: Math.round(nutrition.sugar * 10) / 10,
      sodium: Math.round(nutrition.sodium),
    };
  } catch {
    logger.warn(`Failed to parse nutrition JSON for "${ingredientName}": ${content}`);
    return null;
  }
}
