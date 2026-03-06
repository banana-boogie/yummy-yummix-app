#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env
/**
 * List Missing Images for Manual Generation
 *
 * Generates a manifest of recipes, ingredients, and useful items that do not
 * have an image yet. This replaces automated DALL-E generation.
 *
 * Usage:
 *   deno task pipeline:images --local --type ingredient --limit 20
 *   deno task pipeline:images --production --type all --format csv
 *   deno task pipeline:images --local --type all --output ./missing-images.md --format md
 *
 * Flags:
 *   --type <type>     Entity type: recipe, ingredient, useful_item, all (default: all)
 *   --limit <n>       Max rows to include (default: 50, global across all types)
 *   --format <fmt>    Output format: json, csv, md (default: json)
 *   --output <path>   Output file path (default: data-pipeline/missing-images.<ext>)
 *   --dry-run         Print summary only without writing output file
 */

import { createPipelineConfig, hasFlag, parseEnvironment, parseFlag } from '../lib/config.ts';
import { consumeBudget, createBudget, type RemainingBudget } from '../lib/budget.ts';
import { Logger } from '../lib/logger.ts';
import {
  createImageManifestItem,
  type ImageEntityType,
  type ImageManifestItem,
  imageManifestToCsv,
  imageManifestToMarkdown,
} from '../lib/image-manifest.ts';
import * as db from '../lib/db.ts';

type OutputFormat = 'json' | 'csv' | 'md';

const logger = new Logger('images');
const env = parseEnvironment(Deno.args);
const config = createPipelineConfig(env);

const entityType = parseFlag(Deno.args, '--type', 'all') || 'all';
const parsedLimit = parseInt(parseFlag(Deno.args, '--limit', '50') || '50', 10);
const limit = Number.isNaN(parsedLimit) ? 50 : parsedLimit;
const format = (parseFlag(Deno.args, '--format', 'json') || 'json') as OutputFormat;
const dryRun = hasFlag(Deno.args, '--dry-run');

const defaultOutputExt = format === 'md' ? 'md' : format;
const defaultOutputPath = new URL(
  `../missing-images.${defaultOutputExt}`,
  import.meta.url,
).pathname;
const outputPath = parseFlag(Deno.args, '--output', defaultOutputPath) || defaultOutputPath;
const budget = createBudget(limit);

function getDirname(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const slashIndex = normalized.lastIndexOf('/');
  if (slashIndex <= 0) {
    return '.';
  }
  return normalized.slice(0, slashIndex);
}

function getExtname(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const slashIndex = normalized.lastIndexOf('/');
  const dotIndex = normalized.lastIndexOf('.');
  if (dotIndex <= slashIndex) {
    return '';
  }
  return normalized.slice(dotIndex);
}

interface MissingImageStats {
  ingredientMissing: number;
  ingredientSelected: number;
  recipeMissing: number;
  recipeSelected: number;
  usefulItemMissing: number;
  usefulItemSelected: number;
}

function getName(value: string | null | undefined): string {
  return value?.trim() || '';
}

function toOutputFormat(raw: string): OutputFormat | null {
  if (raw === 'json' || raw === 'csv' || raw === 'md') return raw;
  return null;
}

function serializeOutput(
  outputFormat: OutputFormat,
  items: ImageManifestItem[],
  stats: MissingImageStats,
): string {
  if (outputFormat === 'csv') {
    return imageManifestToCsv(items);
  }

  if (outputFormat === 'md') {
    return imageManifestToMarkdown(items);
  }

  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      environment: env,
      limit,
      selectedCount: items.length,
      stats,
      items,
    },
    null,
    2,
  );
}

async function collectForType<T>(
  label: string,
  type: ImageEntityType,
  budgetState: RemainingBudget,
  fetchRows: () => Promise<T[]>,
  getId: (row: T) => string,
  getNameEn: (row: T) => string | null | undefined,
  getNameEs: (row: T) => string | null | undefined,
  hasImage: (row: T) => boolean,
): Promise<{ missing: number; selected: number; items: ImageManifestItem[] }> {
  const rows = await fetchRows();
  const missingRows = rows.filter((row) => !hasImage(row));
  logger.info(`Found ${missingRows.length} ${label} missing images`);

  const selectedItems: ImageManifestItem[] = [];
  for (const row of missingRows) {
    if (!consumeBudget(budgetState)) break;
    selectedItems.push(
      createImageManifestItem(
        type,
        getId(row),
        getName(getNameEn(row)),
        getName(getNameEs(row)),
      ),
    );
  }

  return {
    missing: missingRows.length,
    selected: selectedItems.length,
    items: selectedItems,
  };
}

async function main() {
  logger.section(`Missing Images Manifest (${env})`);
  if (dryRun) {
    logger.warn('DRY RUN MODE - manifest file will not be written');
  }

  const validTypes = ['ingredient', 'recipe', 'useful_item', 'all'];
  if (!validTypes.includes(entityType)) {
    logger.error(`Invalid --type "${entityType}". Valid: ${validTypes.join(', ')}`);
    Deno.exit(1);
  }

  const validFormat = toOutputFormat(format);
  if (!validFormat) {
    logger.error('Invalid --format. Valid: json, csv, md');
    Deno.exit(1);
  }

  const stats: MissingImageStats = {
    ingredientMissing: 0,
    ingredientSelected: 0,
    recipeMissing: 0,
    recipeSelected: 0,
    usefulItemMissing: 0,
    usefulItemSelected: 0,
  };

  const manifestItems: ImageManifestItem[] = [];

  if (entityType === 'ingredient' || entityType === 'all') {
    const result = await collectForType(
      'ingredients',
      'ingredient',
      budget,
      () => db.fetchAllIngredients(config.supabase),
      (row) => row.id,
      (row) => row.name_en,
      (row) => row.name_es,
      (row) => !!row.image_url,
    );
    stats.ingredientMissing = result.missing;
    stats.ingredientSelected = result.selected;
    manifestItems.push(...result.items);
  }

  if (entityType === 'recipe' || entityType === 'all') {
    const result = await collectForType(
      'recipes',
      'recipe',
      budget,
      () => db.fetchAllRecipes(config.supabase),
      (row) => row.id,
      (row) => row.name_en,
      (row) => row.name_es,
      (row) => !!row.image_url,
    );
    stats.recipeMissing = result.missing;
    stats.recipeSelected = result.selected;
    manifestItems.push(...result.items);
  }

  if (entityType === 'useful_item' || entityType === 'all') {
    const result = await collectForType(
      'useful items',
      'useful_item',
      budget,
      () => db.fetchAllUsefulItems(config.supabase),
      (row) => row.id,
      (row) => row.name_en,
      (row) => row.name_es,
      (row) => !!row.image_url,
    );
    stats.usefulItemMissing = result.missing;
    stats.usefulItemSelected = result.selected;
    manifestItems.push(...result.items);
  }

  const outputText = serializeOutput(validFormat, manifestItems, stats);

  if (!dryRun) {
    await Deno.mkdir(getDirname(outputPath), { recursive: true });
    await Deno.writeTextFile(outputPath, outputText);
  }

  logger.summary({
    'Limit requested': limit,
    'Rows selected': manifestItems.length,
    'Ingredient missing': stats.ingredientMissing,
    'Recipe missing': stats.recipeMissing,
    'Useful item missing': stats.usefulItemMissing,
  });

  if (!dryRun) {
    logger.success(`Wrote missing image manifest: ${outputPath}`);
  } else {
    logger.info('Dry run complete. Re-run without --dry-run to write the manifest file.');
  }
  if (!manifestItems.length) {
    logger.info('No missing images found for the selected scope.');
    return;
  }

  logger.info('Top pending items:');
  for (const item of manifestItems.slice(0, 10)) {
    logger.info(
      `- [${item.entityType}] ${item.displayName} -> ${item.storageBucket}/${item.imagePath}`,
    );
  }

  if (!dryRun) {
    const fileExt = getExtname(outputPath);
    if (!fileExt) {
      logger.warn(
        'Output file has no extension. Consider .json, .csv, or .md for easier handling.',
      );
    }
  }
}

main().catch((error) => {
  logger.error('Fatal error', error);
  Deno.exit(1);
});
