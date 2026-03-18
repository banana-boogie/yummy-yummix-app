#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env
/**
 * Backfill Missing Translations
 *
 * Fills missing `en` and `es-ES` translations for entities that have `es`.
 * Handles both simple entities (ingredients, kitchen tools, tags) in batches
 * and complex entities (recipes with steps + ingredient notes) individually.
 *
 * Usage:
 *   deno task pipeline:backfill-translations --local
 *   deno task pipeline:backfill-translations --local --type ingredients
 *   deno task pipeline:backfill-translations --local --locale en
 *   deno task pipeline:backfill-translations --local --dry-run
 *   deno task pipeline:backfill-translations --local --limit 50
 *
 * Flags:
 *   --local / --production   Target environment
 *   --type <type>            Only process: ingredients, kitchen_tools, tags, recipes (default: all)
 *   --locale <locale>        Only backfill: en or es-ES (default: both)
 *   --limit <n>              Max entities per type to process (default: unlimited)
 *   --dry-run                Show gaps without making changes
 */

import { createPipelineConfig, hasFlag, parseEnvironment, parseFlag } from '../lib/config.ts';
import { Logger } from '../lib/logger.ts';
import { assertRequiredApiKey } from '../lib/cli-validations.ts';
import {
  backfillRecipes,
  backfillSimpleEntities,
  type EntityType,
  type SimpleEntityType,
  type TargetLocale,
} from '../lib/translation-backfill.ts';

const logger = new Logger('backfill');
const env = parseEnvironment(Deno.args);
const config = createPipelineConfig(env);

const typeFilter = parseFlag(Deno.args, '--type') as EntityType | undefined;
const localeFilter = parseFlag(Deno.args, '--locale') as TargetLocale | undefined;
const limitStr = parseFlag(Deno.args, '--limit');
const limit = limitStr ? parseInt(limitStr, 10) : undefined;
const dryRun = hasFlag(Deno.args, '--dry-run');

// Validate flags
const VALID_TYPES: EntityType[] = ['ingredients', 'kitchen_tools', 'tags', 'recipes'];
const VALID_LOCALES: TargetLocale[] = ['en', 'es-ES'];
const SIMPLE_TYPES: SimpleEntityType[] = ['ingredients', 'kitchen_tools', 'tags'];

if (typeFilter && !VALID_TYPES.includes(typeFilter)) {
  console.error(`Invalid --type: ${typeFilter}. Valid: ${VALID_TYPES.join(', ')}`);
  Deno.exit(1);
}
if (localeFilter && !VALID_LOCALES.includes(localeFilter)) {
  console.error(`Invalid --locale: ${localeFilter}. Valid: ${VALID_LOCALES.join(', ')}`);
  Deno.exit(1);
}

async function main() {
  logger.section(`Translation Backfill (${env})`);

  if (!dryRun) {
    assertRequiredApiKey('OPENAI_API_KEY', config.openaiApiKey);
  }

  if (dryRun) {
    logger.warn('DRY RUN — showing gaps only, no changes will be made');
  }
  if (typeFilter) logger.info(`Type filter: ${typeFilter}`);
  if (localeFilter) logger.info(`Locale filter: ${localeFilter}`);
  if (limit) logger.info(`Limit: ${limit} per type`);

  const locales = localeFilter ? [localeFilter] : VALID_LOCALES;
  const types = typeFilter ? [typeFilter] : VALID_TYPES;

  const stats: Record<string, number | string> = {};

  for (const locale of locales) {
    logger.section(`Locale: ${locale}`);

    // Simple entities
    for (const entityType of SIMPLE_TYPES) {
      if (!types.includes(entityType)) continue;

      const result = await backfillSimpleEntities(
        entityType,
        config.supabase,
        config.openaiApiKey,
        locale,
        logger,
        limit,
        dryRun,
      );

      stats[`${entityType} (${locale}) missing`] = result.found;
      if (!dryRun) {
        stats[`${entityType} (${locale}) backfilled`] = result.processed;
      }
    }

    // Recipes
    if (types.includes('recipes')) {
      const result = await backfillRecipes(
        config.supabase,
        config.openaiApiKey,
        locale,
        logger,
        limit,
        dryRun,
      );

      stats[`recipes (${locale}) missing`] = result.found;
      if (!dryRun) {
        stats[`recipes (${locale}) backfilled`] = result.processed;
      }
    }
  }

  logger.summary(stats);
}

main().catch((error) => {
  logger.error('Fatal error', error);
  Deno.exit(1);
});
