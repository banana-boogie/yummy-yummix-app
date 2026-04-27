#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env
/**
 * Fetch Missing Nutritional Facts
 *
 * Finds ingredients missing nutritional data and fetches it using
 * OpenAI (gpt-4.1-mini).
 *
 * Usage:
 *   deno task pipeline:nutrition --local
 *   deno task pipeline:nutrition --production --limit 20
 *   deno task pipeline:nutrition --local --from-audit ./audit-report.json
 */

import { createPipelineConfig, hasFlag, parseEnvironment, parseFlag } from '../lib/config.ts';
import { Logger } from '../lib/logger.ts';
import * as db from '../lib/db.ts';
import { sleep } from '../lib/utils.ts';
import { fetchNutritionFromOpenAI } from '../lib/openai-client.ts';
import type { NutritionData } from '../lib/openai-client.ts';

const logger = new Logger('nutrition');
const env = parseEnvironment(Deno.args);
const config = createPipelineConfig(env);

const limit = parseInt(parseFlag(Deno.args, '--limit', '50') || '50', 10);
const auditFile = parseFlag(Deno.args, '--from-audit');
const dryRun = hasFlag(Deno.args, '--dry-run');

// ─── OpenAI (uses shared retry wrapper) ─────────────────

async function fetchNutrition(ingredientName: string): Promise<NutritionData | null> {
  if (!config.openaiApiKey) return null;
  return fetchNutritionFromOpenAI(ingredientName, config.openaiApiKey, logger);
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

  const [allIngredients, nutritionIds] = await Promise.all([
    db.fetchAllIngredients(config.supabase),
    db.fetchIngredientNutritionIds(config.supabase),
  ]);

  const needsNutrition = allIngredients.filter((ing) => {
    // If we have an audit list, only process those
    if (ingredientIds) return ingredientIds.includes(ing.id);

    // Otherwise, check if nutrition is missing
    return !nutritionIds.has(ing.id);
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

    const nutrition = await fetchNutrition(name);
    const source = 'openai:gpt-4.1-mini';

    if (nutrition) {
      await db.upsertIngredientNutrition(config.supabase, ing.id, {
        ...nutrition,
        source,
      });
      logger.success(
        `Updated ${name}: ${nutrition.calories} cal, ${nutrition.protein}g protein, ${nutrition.fat}g fat, ${nutrition.carbohydrates}g carbs, ${nutrition.fiber}g fiber, ${nutrition.sugar}g sugar, ${nutrition.sodium}mg sodium`,
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
