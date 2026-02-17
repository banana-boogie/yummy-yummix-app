#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env
/**
 * Fetch Missing Nutritional Facts
 *
 * Finds ingredients missing nutritional data and fetches it using
 * the USDA API (primary) with OpenAI fallback.
 *
 * Usage:
 *   deno task pipeline:nutrition --local
 *   deno task pipeline:nutrition --production --limit 20
 *   deno task pipeline:nutrition --local --from-audit ./audit-report.json
 */

import { createPipelineConfig, hasFlag, parseEnvironment, parseFlag } from '../lib/config.ts';
import { Logger } from '../lib/logger.ts';
import * as db from '../lib/db.ts';
import { parseJsonFromLLM, sleep } from '../lib/utils.ts';

const logger = new Logger('nutrition');
const env = parseEnvironment(Deno.args);
const config = createPipelineConfig(env);

const limit = parseInt(parseFlag(Deno.args, '--limit', '50') || '50', 10);
const auditFile = parseFlag(Deno.args, '--from-audit');
const dryRun = hasFlag(Deno.args, '--dry-run');

// ─── USDA API ────────────────────────────────────────────

async function fetchFromUSDA(ingredientName: string): Promise<NutritionData | null> {
  if (!config.usdaApiKey) return null;

  try {
    const params = new URLSearchParams({
      api_key: config.usdaApiKey,
      query: ingredientName,
      pageSize: '1',
      dataType: 'Foundation',
      format: 'full',
    });

    const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?${params}`);
    if (!res.ok) {
      logger.warn(`USDA API returned ${res.status} for "${ingredientName}"`);
      return null;
    }
    const data = await res.json();

    if (!data.foods || data.foods.length === 0) return null;

    const food = data.foods[0];
    const nutrients = food.foodNutrients;

    const findNutrient = (name: string, unitName?: string): number => {
      const match = nutrients.find(
        (n: { nutrientName: string; unitName?: string }) =>
          n.nutrientName === name && (!unitName || n.unitName === unitName),
      );
      return match?.value || 0;
    };

    return {
      calories: Math.round(findNutrient('Energy', 'KCAL')),
      protein: Math.round(findNutrient('Protein') * 10) / 10,
      fat: Math.round(findNutrient('Total lipid (fat)') * 10) / 10,
      carbohydrates: Math.round(findNutrient('Carbohydrate, by difference') * 10) / 10,
    };
  } catch (error) {
    logger.warn(`USDA API error for "${ingredientName}": ${error}`);
    return null;
  }
}

// ─── OpenAI Fallback ─────────────────────────────────────

async function fetchFromOpenAI(ingredientName: string): Promise<NutritionData | null> {
  if (!config.openaiApiKey) return null;

  const maxAttempts = 3;
  const baseBackoffMs = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content:
              `Provide nutritional facts per 100g for ${ingredientName}. Return ONLY a JSON object in this exact format: {"calories": number, "protein": number, "fat": number, "carbohydrates": number}`,
          }],
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        const retryable = res.status === 429 || res.status >= 500;
        if (retryable && attempt < maxAttempts) {
          const backoffMs = baseBackoffMs * (2 ** (attempt - 1));
          logger.warn(
            `OpenAI transient error for "${ingredientName}" (attempt ${attempt}/${maxAttempts}, status ${res.status}). Retrying in ${backoffMs}ms...`,
          );
          await sleep(backoffMs);
          continue;
        }
        throw new Error(`OpenAI API error (${res.status}): ${body}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;

      const nutrition = parseJsonFromLLM(content) as Record<string, unknown> | null;
      if (
        !nutrition ||
        typeof nutrition.calories !== 'number' ||
        typeof nutrition.protein !== 'number' ||
        typeof nutrition.fat !== 'number' ||
        typeof nutrition.carbohydrates !== 'number'
      ) return null;

      return {
        calories: Math.round(nutrition.calories),
        protein: Math.round(nutrition.protein * 10) / 10,
        fat: Math.round(nutrition.fat * 10) / 10,
        carbohydrates: Math.round(nutrition.carbohydrates * 10) / 10,
      };
    } catch (error) {
      if (attempt < maxAttempts) {
        const backoffMs = baseBackoffMs * (2 ** (attempt - 1));
        logger.warn(
          `OpenAI fallback failed for "${ingredientName}" (attempt ${attempt}/${maxAttempts}): ${error}. Retrying in ${backoffMs}ms...`,
        );
        await sleep(backoffMs);
        continue;
      }
      logger.warn(`OpenAI error for "${ingredientName}": ${error}`);
      return null;
    }
  }

  return null;
}

interface NutritionData {
  calories: number;
  protein: number;
  fat: number;
  carbohydrates: number;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  logger.section(`Nutrition Fetch (${env})`);

  // Get ingredients that need nutrition
  let ingredientIds: string[] | null = null;

  if (auditFile) {
    try {
      const report = JSON.parse(Deno.readTextFileSync(auditFile));
      ingredientIds = (report.issuesByType?.missing_nutrition || [])
        .map((issue: { id: string }) => issue.id);
      logger.info(`Loaded ${ingredientIds!.length} ingredients from audit report`);
    } catch (e) {
      logger.error(`Failed to read audit report: ${e}`);
      Deno.exit(1);
    }
  }

  const allIngredients = await db.fetchAllIngredients(config.supabase);

  const needsNutrition = allIngredients.filter((ing) => {
    // If we have an audit list, only process those
    if (ingredientIds) return ingredientIds.includes(ing.id);

    // Otherwise, check if nutrition is missing
    const facts = ing.nutritional_facts;
    if (!facts || typeof facts !== 'object') return true;
    if (!('per_100g' in facts)) return true;
    return false;
  });

  const toProcess = needsNutrition.slice(0, limit);
  logger.info(
    `Processing ${toProcess.length} of ${needsNutrition.length} ingredients missing nutrition (limit: ${limit})`,
  );

  if (dryRun) {
    logger.warn('DRY RUN - no changes will be made');
    for (const ing of toProcess) {
      logger.info(`Would fetch nutrition for: ${ing.name_en}`);
    }
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const ing of toProcess) {
    const name = ing.name_en || ing.name_es;
    logger.info(`Fetching nutrition for: ${name}`);

    // Try USDA first, then OpenAI
    let nutrition = await fetchFromUSDA(name);
    if (!nutrition) {
      logger.info(`USDA miss for "${name}", trying OpenAI...`);
      nutrition = await fetchFromOpenAI(name);
    }

    if (nutrition) {
      await db.updateIngredient(config.supabase, ing.id, {
        nutritional_facts: { per_100g: nutrition },
      });
      logger.success(
        `Updated ${name}: ${nutrition.calories} cal, ${nutrition.protein}g protein, ${nutrition.fat}g fat, ${nutrition.carbohydrates}g carbs`,
      );
      successCount++;
    } else {
      logger.error(`No nutrition data found for: ${name}`);
      failCount++;
    }

    // Small delay to respect rate limits
    await sleep(500);
  }

  logger.summary({
    'Total needing nutrition': needsNutrition.length,
    'Processed': toProcess.length,
    'Succeeded': successCount,
    'Failed': failCount,
  });
}

main().catch((error) => {
  logger.error('Fatal error', error);
  Deno.exit(1);
});
