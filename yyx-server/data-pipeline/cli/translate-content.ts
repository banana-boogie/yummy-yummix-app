#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env
/**
 * Translate Missing Content
 *
 * Uses OpenAI GPT-4o-mini to translate recipes, ingredients, and
 * kitchen tools that are missing one language.
 *
 * Usage:
 *   deno task pipeline:translate --local
 *   deno task pipeline:translate --production --limit 20
 *   deno task pipeline:translate --local --dry-run
 */

import { createPipelineConfig, hasFlag, parseEnvironment, parseFlag } from '../lib/config.ts';
import { assertRequiredApiKey } from '../lib/cli-validations.ts';
import { Logger } from '../lib/logger.ts';
import * as db from '../lib/db.ts';
import { allocateTranslationLimit } from '../lib/translation-limit.ts';
import { sleep } from '../lib/utils.ts';

const logger = new Logger('translate');
const env = parseEnvironment(Deno.args);
const config = createPipelineConfig(env);

const parsedLimit = parseInt(parseFlag(Deno.args, '--limit', '50') || '50', 10);
const limit = Number.isNaN(parsedLimit) ? 50 : parsedLimit;
const dryRun = hasFlag(Deno.args, '--dry-run');

// ─── Translation via OpenAI ──────────────────────────────

async function translate(
  text: string,
  fromLang: 'English' | 'Spanish',
  toLang: 'English' | 'Mexican Spanish',
): Promise<string> {
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
          `Translate the following ${fromLang} food/cooking term to ${toLang}. Return ONLY the translated text, nothing else.\n\n${text}`,
      }],
      temperature: 0.3,
      max_tokens: 200,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Translation API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  const translated = data.choices?.[0]?.message?.content?.trim() || '';
  if (!translated) {
    throw new Error(`Translation returned empty result for "${text}"`);
  }
  return translated;
}

async function translatePair(
  nameEn: string | null,
  nameEs: string | null,
): Promise<{ nameEn: string; nameEs: string }> {
  if (nameEn && !nameEs) {
    const translated = await translate(nameEn, 'English', 'Mexican Spanish');
    return { nameEn, nameEs: translated };
  }
  if (nameEs && !nameEn) {
    const translated = await translate(nameEs, 'Spanish', 'English');
    return { nameEn: translated, nameEs };
  }
  return { nameEn: nameEn || '', nameEs: nameEs || '' };
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  logger.section(`Content Translation (${env})`);

  try {
    assertRequiredApiKey('OPENAI_API_KEY', config.openaiApiKey);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }

  if (dryRun) {
    logger.warn('DRY RUN MODE - no changes will be made');
  }

  let totalTranslated = 0;

  logger.info('Checking ingredients...');
  const ingredients = await db.fetchAllIngredients(config.supabase);
  const needsTranslation = ingredients.filter(
    (i) => (!i.name_en && i.name_es) || (i.name_en && !i.name_es),
  );

  logger.info('Checking kitchen tools...');
  const items = await db.fetchAllKitchenTools(config.supabase);
  const itemsNeedTranslation = items.filter(
    (i) => (!i.name_en && i.name_es) || (i.name_en && !i.name_es),
  );

  logger.info('Checking tags...');
  const tags = await db.fetchAllTags(config.supabase);
  const tagsNeedTranslation = tags.filter(
    (t) => (!t.name_en && t.name_es) || (t.name_en && !t.name_es),
  );

  const allocation = allocateTranslationLimit(
    needsTranslation.length,
    itemsNeedTranslation.length,
    tagsNeedTranslation.length,
    limit,
  );

  logger.info(
    `Global limit allocation -> ingredients: ${allocation.ingredientCount}, kitchen tools: ${allocation.kitchenToolCount}, tags: ${allocation.tagCount}`,
  );

  // ─── Translate Ingredients ─────────────────────────────
  if (needsTranslation.length > 0) {
    logger.info(`Found ${needsTranslation.length} ingredients needing translation`);
    for (const ing of needsTranslation.slice(0, allocation.ingredientCount)) {
      const name = ing.name_en || ing.name_es;
      if (dryRun) {
        logger.info(`[DRY RUN] Would translate ingredient: ${name}`);
        continue;
      }

      try {
        const { nameEn, nameEs } = await translatePair(ing.name_en, ing.name_es);
        const plurals = await translatePair(ing.plural_name_en, ing.plural_name_es);

        // Use upsertEntityTranslations to persist to ingredient_translations table
        const translationRows = [];
        if (nameEn || plurals.nameEn) {
          translationRows.push({
            ingredient_id: ing.id,
            locale: 'en',
            name: nameEn,
            plural_name: plurals.nameEn,
          });
        }
        if (nameEs || plurals.nameEs) {
          translationRows.push({
            ingredient_id: ing.id,
            locale: 'es',
            name: nameEs,
            plural_name: plurals.nameEs,
          });
        }
        await db.upsertEntityTranslations(
          config.supabase,
          'ingredient_translations',
          'ingredient_id',
          translationRows,
        );
        logger.success(`Translated ingredient: ${name} -> EN: ${nameEn}, ES: ${nameEs}`);
        totalTranslated++;
      } catch (error) {
        logger.error(`Failed to translate "${name}": ${error}`);
      }

      await sleep(500);
    }
  }

  // ─── Translate Useful Items ────────────────────────────
  if (itemsNeedTranslation.length > 0) {
    logger.info(`Found ${itemsNeedTranslation.length} kitchen tools needing translation`);
    for (const item of itemsNeedTranslation.slice(0, allocation.kitchenToolCount)) {
      const name = item.name_en || item.name_es;
      if (dryRun) {
        logger.info(`[DRY RUN] Would translate kitchen tool: ${name}`);
        continue;
      }

      try {
        const { nameEn, nameEs } = await translatePair(item.name_en, item.name_es);

        // Use upsertEntityTranslations to persist to kitchen_tool_translations table
        const translationRows = [];
        if (nameEn) {
          translationRows.push({
            kitchen_tool_id: item.id,
            locale: 'en',
            name: nameEn,
          });
        }
        if (nameEs) {
          translationRows.push({
            kitchen_tool_id: item.id,
            locale: 'es',
            name: nameEs,
          });
        }
        await db.upsertEntityTranslations(
          config.supabase,
          'kitchen_tool_translations',
          'kitchen_tool_id',
          translationRows,
        );
        logger.success(`Translated kitchen tool: ${name} -> EN: ${nameEn}, ES: ${nameEs}`);
        totalTranslated++;
      } catch (error) {
        logger.error(`Failed to translate "${name}": ${error}`);
      }

      await sleep(500);
    }
  }

  // ─── Translate Tags ────────────────────────────────────
  if (tagsNeedTranslation.length > 0) {
    logger.info(`Found ${tagsNeedTranslation.length} tags needing translation`);
    for (const tag of tagsNeedTranslation.slice(0, allocation.tagCount)) {
      const name = tag.name_en || tag.name_es;
      if (dryRun) {
        logger.info(`[DRY RUN] Would translate tag: ${name}`);
        continue;
      }

      try {
        const { nameEn, nameEs } = await translatePair(tag.name_en, tag.name_es);

        // Use upsertEntityTranslations to persist to recipe_tag_translations table
        const translationRows = [];
        if (nameEn) {
          translationRows.push({
            recipe_tag_id: tag.id,
            locale: 'en',
            name: nameEn,
          });
        }
        if (nameEs) {
          translationRows.push({
            recipe_tag_id: tag.id,
            locale: 'es',
            name: nameEs,
          });
        }
        await db.upsertEntityTranslations(
          config.supabase,
          'recipe_tag_translations',
          'recipe_tag_id',
          translationRows,
        );

        logger.success(`Translated tag: ${name} -> EN: ${nameEn}, ES: ${nameEs}`);
        totalTranslated++;
      } catch (error) {
        logger.error(`Failed to translate "${name}": ${error}`);
      }

      await sleep(500);
    }
  }

  logger.summary({
    'Global translation limit': limit,
    'Ingredients needing translation': needsTranslation.length,
    'Kitchen tools needing translation': itemsNeedTranslation.length,
    'Tags needing translation': tagsNeedTranslation.length,
    'Allocated for this run': allocation.total,
    'Total translated': totalTranslated,
  });
}

main().catch((error) => {
  logger.error('Fatal error', error);
  Deno.exit(1);
});
