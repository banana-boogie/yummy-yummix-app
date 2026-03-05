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
 *   --local          Target local Supabase instance
 *   --production     Target production Supabase
 *   --reset          Reset progress tracker and start fresh
 *   --dir <path>     Directory containing markdown files (default: data/notion-exports)
 *   --limit <n>      Max recipes to import this run (default: unlimited)
 *   --skip-existing  Skip recipes that already exist in DB (by name match)
 *   --dry-run        Parse and resolve entities but skip all DB writes (for previewing output)
 */

import { createPipelineConfig, hasFlag, parseEnvironment, parseFlag } from '../lib/config.ts';
import { sleep } from '../lib/utils.ts';
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
import { assertRequiredApiKey } from '../lib/cli-validations.ts';

const logger = new Logger('import');
const env = parseEnvironment(Deno.args);
const config = createPipelineConfig(env);

const dataDir = parseFlag(Deno.args, '--dir') ||
  new URL('../data/notion-exports', import.meta.url).pathname;
const skipExisting = hasFlag(Deno.args, '--skip-existing');
const dryRun = hasFlag(Deno.args, '--dry-run');
const limitArg = parseFlag(Deno.args, '--limit');
const limit = limitArg ? parseInt(limitArg, 10) : Infinity;

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

// ─── Pre-filter: detect stub files ───────────────────────

/**
 * Returns true if the markdown file has actual recipe content
 * (at least one ingredient line). Stubs have empty sections.
 */
function hasRecipeContent(content: string): boolean {
  const lines = content.split('\n');
  let inIngredientes = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '### Ingredientes') {
      inIngredientes = true;
      continue;
    }
    if (inIngredientes) {
      if (trimmed.startsWith('#')) break; // Hit next section — nothing found
      if (trimmed.startsWith('-') && trimmed.length > 2) return true;
    }
  }
  return false;
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
  if (skipExisting && !dryRun) {
    const existingId = await db.findRecipeByName(config.supabase, parsed.nameEn, parsed.nameEs);
    if (existingId) {
      logger.warn(`Skipping existing recipe: "${parsed.nameEn}" (${existingId})`);
      return existingId;
    }
  }

  // 3. Resolve all entities (matching only — no DB writes in dry-run)
  const { recipeIngredients, ingredientMap } = dryRun
    ? await resolveIngredientsDry(parsed, allIngredients, allUnits)
    : await resolveIngredients(parsed, allIngredients, allUnits);
  const tagIds = dryRun
    ? resolveTags_dry(parsed.tags, allTags)
    : await resolveTags(parsed.tags, allTags);
  const usefulItems = dryRun
    ? resolveUsefulItemsDry(parsed, allItems)
    : await resolveUsefulItems(parsed, allItems);

  // In dry-run mode: log everything and return without DB writes
  if (dryRun) {
    logger.info('--- DRY RUN OUTPUT ---');
    logger.info(`Name (EN): ${parsed.nameEn}`);
    logger.info(`Name (ES): ${parsed.nameEs}`);
    logger.info(`Difficulty: ${parsed.difficulty} | Prep: ${parsed.prepTime}min | Total: ${parsed.totalTime}min | Portions: ${parsed.portions}`);
    logger.info(`Tags (${parsed.tags.length}): ${parsed.tags.join(', ')}`);
    logger.info(`Ingredients (${parsed.ingredients.length}):`);
    for (const ing of parsed.ingredients) {
      logger.info(
        `  - ${ing.quantity} ${ing.measurementUnitID || ''} ${ing.ingredient.nameEn} / ${ing.ingredient.nameEs}`,
      );
    }
    logger.info(`Steps (${parsed.steps.length}):`);
    for (const step of parsed.steps) {
      const tmx = step.thermomixTime
        ? ` [TM: ${step.thermomixTime}s ${step.thermomixTemperature ? step.thermomixTemperature + '°' : ''} vel${step.thermomixSpeed?.type === 'single' ? step.thermomixSpeed.value : '?'}]`
        : '';
      logger.info(`  ${step.order}. ${step.instructionEn}${tmx}`);
    }
    logger.info(`Useful items (${parsed.usefulItems.length}): ${parsed.usefulItems.map((i) => i.nameEn).join(', ')}`);
    if (parsed.tipsAndTricksEn) logger.info(`Tips: ${parsed.tipsAndTricksEn}`);

    // Show entity resolution status
    const missingIngredients = parsed.ingredients.filter(
      (i) => !allIngredients.some(
        (db) =>
          (db.name_en?.toLowerCase() ?? '') === i.ingredient.nameEn.toLowerCase() ||
          (db.name_es?.toLowerCase() ?? '') === i.ingredient.nameEs.toLowerCase(),
      ),
    );
    const missingTags = parsed.tags.filter(
      (t) => !allTags.some(
        (db) =>
          (db.name_en?.toLowerCase() ?? '') === t.toLowerCase() ||
          (db.name_es?.toLowerCase() ?? '') === t.toLowerCase(),
      ),
    );
    const missingItems = parsed.usefulItems.filter(
      (i) => !allItems.some((db) => (db.name_en?.toLowerCase() ?? '') === i.nameEn.toLowerCase()),
    );

    if (missingIngredients.length > 0) {
      logger.warn(`Would create ${missingIngredients.length} new ingredient(s): ${missingIngredients.map((i) => i.ingredient.nameEn).join(', ')}`);
    }
    if (missingTags.length > 0) {
      logger.warn(`Would create ${missingTags.length} new tag(s): ${missingTags.join(', ')}`);
    }
    if (missingItems.length > 0) {
      logger.warn(`Would create ${missingItems.length} new useful item(s): ${missingItems.map((i) => i.nameEn).join(', ')}`);
    }

    logger.info('--- END DRY RUN ---');
    return '[dry-run]';
  }

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
        .slice(0, 3)
        .map((item) =>
          `[step ${item.stepOrder}] ${item.ingredientNameEn || item.ingredientNameEs}`
        )
        .join(', ');
      logger.warn(
        `${unresolved.length} unresolved step-ingredient link(s) for "${parsed.nameEs}" (${preview}) — importing without them`,
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

// ─── Dry-run entity resolvers (match only, no DB writes) ─

function resolveIngredientsDry(
  parsed: ParsedRecipeData,
  allIngredients: DbIngredient[],
  allUnits: DbMeasurementUnit[],
): Promise<{ recipeIngredients: db.RecipeIngredientInsert[]; ingredientMap: Map<string, DbIngredient> }> {
  const recipeIngredients: db.RecipeIngredientInsert[] = [];
  const ingredientMap = new Map<string, DbIngredient>();

  for (const item of parsed.ingredients) {
    const matched = matchIngredient(item.ingredient, allIngredients);
    if (matched) {
      ingredientMap.set(item.ingredient.nameEn.toLowerCase(), matched);
      ingredientMap.set(item.ingredient.nameEs.toLowerCase(), matched);
    }
    const unit = matchMeasurementUnit(item.measurementUnitID, allUnits);
    recipeIngredients.push({
      recipe_id: '',
      ingredient_id: matched?.id ?? '',
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

  return Promise.resolve({ recipeIngredients, ingredientMap });
}

function resolveTags_dry(tagNames: string[], allTags: DbRecipeTag[]): Promise<string[]> {
  return Promise.resolve(
    tagNames
      .map((name) => matchTag(name, allTags)?.id)
      .filter((id): id is string => id !== undefined),
  );
}

function resolveUsefulItemsDry(
  parsed: ParsedRecipeData,
  allItems: DbUsefulItem[],
): Promise<Array<{ useful_item_id: string; display_order: number; notes_en: string; notes_es: string }>> {
  return Promise.resolve(
    parsed.usefulItems
      .map((item, i) => {
        const matched = matchUsefulItem(item, allItems);
        return matched
          ? { useful_item_id: matched.id, display_order: i, notes_en: '', notes_es: '' }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  );
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  logger.section(`Recipe Import (${env})${dryRun ? ' [DRY RUN]' : ''}`);
  if (dryRun) logger.warn('Dry-run mode: no data will be written to the database');

  try {
    assertRequiredApiKey('OPENAI_API_KEY', config.openaiApiKey);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }

  // Load markdown files
  let markdownFiles: Array<{ filename: string; content: string }>;
  try {
    markdownFiles = loadMarkdownFiles(dataDir);
  } catch (e) {
    logger.error(`Failed to load markdown files from ${dataDir}: ${e}`);
    logger.info(
      'Place Notion markdown exports in data-pipeline/data/notion-exports/, or pass --dir path/to/RECIPES/',
    );
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

  // Pre-filter: skip stubs (no ingredients) and already completed
  const alreadyDone = markdownFiles.filter((f) => tracker.isCompleted(f.filename)).length;
  const stubs = markdownFiles.filter(
    (f) => !tracker.isCompleted(f.filename) && !hasRecipeContent(f.content),
  );
  const pending = markdownFiles.filter(
    (f) => !tracker.isCompleted(f.filename) && hasRecipeContent(f.content),
  );

  logger.info(`Already completed: ${alreadyDone}`);
  logger.info(`Skipped (no content): ${stubs.length}`);
  logger.info(`Ready to import: ${pending.length}${limit !== Infinity ? ` (limit: ${limit})` : ''}`);

  // Mark stubs as completed so they don't re-appear on next run (skip in dry-run)
  if (!dryRun) {
    for (const stub of stubs) {
      tracker.markCompleted(stub.filename);
    }
  }

  const toProcess = limit !== Infinity ? pending.slice(0, limit) : pending;

  // Process each recipe
  let successCount = 0;
  let failCount = 0;

  for (const file of toProcess) {
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
      if (!dryRun) tracker.markCompleted(file.filename);
      successCount++;
      logger.success(`${dryRun ? 'Parsed' : 'Imported'} "${file.filename}"${dryRun ? '' : ` -> ${recipeId}`}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to ${dryRun ? 'parse' : 'import'} "${file.filename}": ${msg}`);
      if (!dryRun) tracker.markFailed(file.filename, msg);
      failCount++;
    }

    // Small delay between OpenAI calls
    if (toProcess.indexOf(file) < toProcess.length - 1) await sleep(500);
  }

  // Summary
  logger.summary({
    'Total files': markdownFiles.length,
    'Stubs skipped (no content)': stubs.length,
    'Previously completed': alreadyDone,
    'Imported this run': successCount,
    'Failed this run': failCount,
    'Remaining': pending.length - toProcess.length,
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
