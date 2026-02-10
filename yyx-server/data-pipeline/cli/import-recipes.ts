#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env
/**
 * Import Recipes from Notion Markdown Exports
 *
 * Usage:
 *   deno task pipeline:import --local
 *   deno task pipeline:import --production
 *   deno task pipeline:import --local --reset
 *   deno task pipeline:import --local --dir ./path/to/markdown/files
 *
 * Flags:
 *   --local       Target local Supabase instance
 *   --production  Target production Supabase
 *   --reset       Reset progress tracker and start fresh
 *   --dir <path>  Directory containing markdown files (default: data/notion-exports)
 *   --skip-existing  Skip recipes that already exist in DB (by name match)
 */

import { createPipelineConfig, hasFlag, parseEnvironment, parseFlag } from '../lib/config.ts';
import { Logger } from '../lib/logger.ts';
import { ProgressTracker } from '../lib/progress-tracker.ts';
import { type ParsedRecipeData, parseRecipeMarkdown } from '../lib/recipe-parser.ts';
import {
  type DbIngredient,
  type DbMeasurementUnit,
  type DbRecipeTag,
  type DbUsefulItem,
  matchIngredient,
  matchMeasurementUnit,
  matchTag,
  matchUsefulItem,
} from '../lib/entity-matcher.ts';
import { resolveStepIngredients } from '../lib/step-ingredient-resolver.ts';
import * as db from '../lib/db.ts';

const logger = new Logger('import');
const env = parseEnvironment(Deno.args);
const config = createPipelineConfig(env);

const dataDir = parseFlag(Deno.args, '--dir') ||
  new URL('../data/notion-exports', import.meta.url).pathname;
const skipExisting = hasFlag(Deno.args, '--skip-existing');

const progressFile = new URL('../.import-progress.json', import.meta.url).pathname;
const tracker = new ProgressTracker(progressFile);

if (hasFlag(Deno.args, '--reset')) {
  logger.warn('Resetting progress tracker');
  tracker.reset();
}

// ─── Load Markdown Files ─────────────────────────────────

function loadMarkdownFiles(dir: string): Array<{ filename: string; content: string }> {
  const files: Array<{ filename: string; content: string }> = [];
  for (const entry of Deno.readDirSync(dir)) {
    if (entry.isFile && entry.name.endsWith('.md')) {
      const content = Deno.readTextFileSync(`${dir}/${entry.name}`);
      files.push({ filename: entry.name, content });
    }
  }
  files.sort((a, b) => a.filename.localeCompare(b.filename));
  return files;
}

// ─── Resolve Entities ────────────────────────────────────

/** Resolve all ingredients: match existing or create new ones */
async function resolveIngredients(
  parsed: ParsedRecipeData,
  allIngredients: DbIngredient[],
  allUnits: DbMeasurementUnit[],
): Promise<{
  recipeIngredients: db.RecipeIngredientInsert[];
  ingredientMap: Map<string, DbIngredient>;
}> {
  const recipeIngredients: db.RecipeIngredientInsert[] = [];
  // Map from ingredient nameEn (lowercase) to DbIngredient for step matching
  const ingredientMap = new Map<string, DbIngredient>();

  for (const item of parsed.ingredients) {
    let matched = matchIngredient(item.ingredient, allIngredients);

    if (!matched) {
      logger.info(
        `Creating missing ingredient: ${item.ingredient.nameEn} / ${item.ingredient.nameEs}`,
      );
      matched = await db.createIngredient(config.supabase, {
        name_en: item.ingredient.nameEn,
        name_es: item.ingredient.nameEs,
        plural_name_en: item.ingredient.pluralNameEn,
        plural_name_es: item.ingredient.pluralNameEs,
      });
      // Add to local cache so subsequent recipes can match it
      allIngredients.push(matched);
    }

    ingredientMap.set(item.ingredient.nameEn.toLowerCase(), matched);
    ingredientMap.set(item.ingredient.nameEs.toLowerCase(), matched);

    const unit = matchMeasurementUnit(item.measurementUnitID, allUnits);

    recipeIngredients.push({
      recipe_id: '', // Will be set after recipe creation
      ingredient_id: matched.id,
      quantity: item.quantity,
      measurement_unit_id: unit?.id || null,
      notes_en: item.notesEn || '',
      notes_es: item.notesEs || '',
      tip_en: item.tipEn || '',
      tip_es: item.tipEs || '',
      optional: false,
      display_order: item.displayOrder,
      recipe_section_en: item.recipeSectionEn || 'Main',
      recipe_section_es: item.recipeSectionEs || 'Principal',
    });
  }

  return { recipeIngredients, ingredientMap };
}

/** Resolve tags: match existing or create new ones */
async function resolveTags(
  tagNames: string[],
  allTags: DbRecipeTag[],
): Promise<string[]> {
  const tagIds: string[] = [];
  const seen = new Set<string>();

  for (const tagName of tagNames) {
    let matched = matchTag(tagName, allTags);

    if (!matched) {
      const cleanName = tagName.startsWith('#') ? tagName.substring(1) : tagName;
      logger.info(`Creating missing tag: ${cleanName}`);
      matched = await db.createTag(config.supabase, {
        name_en: cleanName,
        name_es: cleanName, // Will need translation later
        categories: ['GENERAL'],
      });
      allTags.push(matched);
    }

    if (!seen.has(matched.id)) {
      seen.add(matched.id);
      tagIds.push(matched.id);
    }
  }

  return tagIds;
}

/** Resolve useful items: match existing or create new ones */
async function resolveUsefulItems(
  parsed: ParsedRecipeData,
  allItems: DbUsefulItem[],
): Promise<
  Array<{ useful_item_id: string; display_order: number; notes_en: string; notes_es: string }>
> {
  const result: Array<
    { useful_item_id: string; display_order: number; notes_en: string; notes_es: string }
  > = [];

  for (const item of parsed.usefulItems) {
    let matched = matchUsefulItem(item, allItems);

    if (!matched) {
      logger.info(`Creating missing useful item: ${item.nameEn} / ${item.nameEs}`);
      matched = await db.createUsefulItem(config.supabase, {
        name_en: item.nameEn,
        name_es: item.nameEs,
      });
      allItems.push(matched);
    }

    result.push({
      useful_item_id: matched.id,
      display_order: item.displayOrder,
      notes_en: item.notesEn || '',
      notes_es: item.notesEs || '',
    });
  }

  return result;
}

/** Build recipe steps with Thermomix parameters */
function buildRecipeSteps(
  recipeId: string,
  parsed: ParsedRecipeData,
): db.RecipeStepInsert[] {
  return parsed.steps.map((step) => {
    let speed: number | string | null = null;
    let speedStart: number | string | null = null;
    let speedEnd: number | string | null = null;

    if (step.thermomixSpeed) {
      if (step.thermomixSpeed.type === 'single') {
        speed = step.thermomixSpeed.value;
      } else if (step.thermomixSpeed.type === 'range') {
        speedStart = step.thermomixSpeed.start;
        speedEnd = step.thermomixSpeed.end;
      }
    }

    return {
      recipe_id: recipeId,
      order: step.order,
      instruction_en: step.instructionEn,
      instruction_es: step.instructionEs,
      thermomix_time: step.thermomixTime,
      thermomix_speed: speed,
      thermomix_speed_start: speedStart,
      thermomix_speed_end: speedEnd,
      thermomix_temperature: step.thermomixTemperature,
      thermomix_temperature_unit: step.thermomixTemperatureUnit,
      thermomix_is_blade_reversed: step.thermomixIsBladeReversed,
      recipe_section_en: step.recipeSectionEn || 'Main',
      recipe_section_es: step.recipeSectionEs || 'Principal',
      tip_en: step.tipEn || '',
      tip_es: step.tipEs || '',
    };
  });
}

// ─── Main Import Flow ────────────────────────────────────

async function importRecipe(
  markdown: string,
  filename: string,
  allIngredients: DbIngredient[],
  allTags: DbRecipeTag[],
  allItems: DbUsefulItem[],
  allUnits: DbMeasurementUnit[],
): Promise<string> {
  // 1. Parse markdown with OpenAI
  const parsed = await parseRecipeMarkdown(markdown, config.openaiApiKey, logger);

  // Validate critical data
  if (!parsed.steps || parsed.steps.length === 0) {
    throw new Error(`Recipe "${parsed.nameEn}" has no steps — skipping to avoid incomplete data`);
  }
  if (!parsed.ingredients || parsed.ingredients.length === 0) {
    throw new Error(
      `Recipe "${parsed.nameEn}" has no ingredients — skipping to avoid incomplete data`,
    );
  }

  // 2. Check for duplicate
  if (skipExisting) {
    const existingId = await db.findRecipeByName(config.supabase, parsed.nameEn, parsed.nameEs);
    if (existingId) {
      logger.warn(`Skipping existing recipe: "${parsed.nameEn}" (${existingId})`);
      return existingId;
    }
  }

  // 3. Resolve all entities
  const { recipeIngredients, ingredientMap } = await resolveIngredients(
    parsed,
    allIngredients,
    allUnits,
  );
  const tagIds = await resolveTags(parsed.tags, allTags);
  const usefulItems = await resolveUsefulItems(parsed, allItems);

  // 4. Create recipe
  const recipeId = await db.createRecipe(config.supabase, {
    name_en: parsed.nameEn,
    name_es: parsed.nameEs,
    difficulty: parsed.difficulty,
    prep_time: parsed.prepTime,
    total_time: parsed.totalTime,
    portions: parsed.portions,
    is_published: false, // Safety: require manual publish
    tips_and_tricks_en: parsed.tipsAndTricksEn || '',
    tips_and_tricks_es: parsed.tipsAndTricksEs || '',
  });

  logger.info(`Created recipe: ${recipeId}`);

  // Wrap child inserts so we can clean up the recipe on failure
  try {
    // 5. Insert recipe ingredients
    const ingredientsWithRecipeId = recipeIngredients.map((ri) => ({
      ...ri,
      recipe_id: recipeId,
    }));
    await db.insertRecipeIngredients(config.supabase, ingredientsWithRecipeId);

    // 6. Insert recipe steps
    const steps = buildRecipeSteps(recipeId, parsed);
    const insertedSteps = await db.insertRecipeSteps(config.supabase, steps);

    // 7. Insert step ingredients
    const { items: stepIngredients, unresolved } = resolveStepIngredients(
      recipeId,
      parsed,
      insertedSteps,
      ingredientMap,
      allIngredients,
      allUnits,
    );

    if (unresolved.length > 0) {
      const preview = unresolved
        .slice(0, 5)
        .map((item) =>
          `[step ${item.stepOrder}] ${
            item.ingredientNameEn || item.ingredientNameEs
          } (${item.reason})`
        )
        .join('; ');

      throw new Error(
        `Unresolved step-ingredient links (${unresolved.length}) for "${parsed.nameEn}": ${preview}`,
      );
    }

    await db.insertRecipeStepIngredients(config.supabase, stepIngredients);

    // 8. Insert tags
    await db.insertRecipeTags(config.supabase, recipeId, tagIds);

    // 9. Insert useful items
    await db.insertRecipeUsefulItems(config.supabase, recipeId, usefulItems);
  } catch (childError) {
    // Clean up the orphaned recipe row (FK cascades delete children)
    logger.warn(`Cleaning up partial recipe "${parsed.nameEn}" (${recipeId}) after error`);
    try {
      await db.deleteRecipe(config.supabase, recipeId);
    } catch (cleanupError) {
      logger.error(`Failed to clean up recipe ${recipeId}: ${cleanupError}`);
    }
    throw childError;
  }

  return recipeId;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  logger.section(`Recipe Import (${env})`);

  // Load markdown files
  let markdownFiles: Array<{ filename: string; content: string }>;
  try {
    markdownFiles = loadMarkdownFiles(dataDir);
  } catch (e) {
    logger.error(`Failed to load markdown files from ${dataDir}: ${e}`);
    logger.info('Place your Notion markdown exports in: data-pipeline/data/notion-exports/');
    Deno.exit(1);
  }

  logger.info(`Found ${markdownFiles.length} markdown files in ${dataDir}`);

  if (markdownFiles.length === 0) {
    logger.warn('No markdown files found. Nothing to import.');
    Deno.exit(0);
  }

  // Pre-load all reference data (cached in memory for the entire run)
  logger.info('Loading reference data from database...');
  const [allIngredients, allTags, allItems, allUnits] = await Promise.all([
    db.fetchAllIngredients(config.supabase),
    db.fetchAllTags(config.supabase),
    db.fetchAllUsefulItems(config.supabase),
    db.fetchAllMeasurementUnits(config.supabase),
  ]);

  logger.info(
    `Loaded: ${allIngredients.length} ingredients, ${allTags.length} tags, ${allItems.length} useful items, ${allUnits.length} measurement units`,
  );

  // Filter already completed
  const pending = markdownFiles.filter((f) => !tracker.isCompleted(f.filename));
  logger.info(
    `${pending.length} recipes pending (${
      markdownFiles.length - pending.length
    } already completed)`,
  );

  // Process each recipe
  let successCount = 0;
  let failCount = 0;

  for (const file of pending) {
    try {
      logger.section(`Processing: ${file.filename}`);
      const recipeId = await importRecipe(
        file.content,
        file.filename,
        allIngredients,
        allTags,
        allItems,
        allUnits,
      );
      tracker.markCompleted(file.filename);
      successCount++;
      logger.success(`Imported "${file.filename}" -> ${recipeId}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to import "${file.filename}": ${msg}`);
      tracker.markFailed(file.filename, msg);
      failCount++;
    }
  }

  // Summary
  logger.summary({
    'Total files': markdownFiles.length,
    'Imported this run': successCount,
    'Failed this run': failCount,
    'Previously completed': markdownFiles.length - pending.length,
    'Ingredients in DB': allIngredients.length,
    'Tags in DB': allTags.length,
    'Useful items in DB': allItems.length,
  });

  if (failCount > 0) {
    logger.warn('Failed files:');
    for (const f of tracker.getFailedItems()) {
      logger.error(`  ${f.id}: ${f.error}`);
    }
    logger.info('Re-run the import to retry failed files.');
  }
}

main().catch((error) => {
  logger.error('Fatal error', error);
  Deno.exit(1);
});
