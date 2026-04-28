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
import { type ParsedRecipeData, parseRecipe } from '../lib/recipe-parser.ts';
import {
  type DbIngredient,
  type DbKitchenTool,
  type DbMeasurementUnit,
  type DbRecipeTag,
  matchIngredient,
  matchKitchenTool,
  matchMeasurementUnit,
  matchTag,
  matchTagBySlug,
} from '../lib/entity-matcher.ts';
import { resolveStepIngredients } from '../lib/step-ingredient-resolver.ts';
import { buildRecipeSteps, hasRecipeContent } from '../lib/import-helpers.ts';
import { INTENTIONAL_DROPS, resolveNotionTag } from '../lib/notion-tag-map.ts';
import * as db from '../lib/db.ts';
import { adaptToSpainSpanish, type SpainAdaptOutput } from '../lib/spain-adapter.ts';
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

function loadMarkdownFiles(
  dir: string,
): Array<{ filename: string; content: string }> {
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
  newlyCreatedIngredients: Array<
    { id: string; nameEs: string; pluralNameEs: string }
  >;
}> {
  const recipeIngredients: db.RecipeIngredientInsert[] = [];
  const ingredientMap = new Map<string, DbIngredient>();
  const newlyCreatedIngredients: Array<
    { id: string; nameEs: string; pluralNameEs: string }
  > = [];

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
      allIngredients.push(matched);
      newlyCreatedIngredients.push({
        id: matched.id,
        nameEs: item.ingredient.nameEs,
        pluralNameEs: item.ingredient.pluralNameEs,
      });
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

  return { recipeIngredients, ingredientMap, newlyCreatedIngredients };
}

/** Resolve tags via the Notion tag map (slug-first), then fall back to a
 * direct name match for tags that happen to share a canonical display name.
 * Tags that resolve to neither and are not in INTENTIONAL_DROPS are logged
 * as "unmapped" so they can be triaged into the map.
 *
 * The taxonomy is seeded via migration; this importer never creates tags. */
async function resolveTags(
  tagNames: string[],
  allTags: DbRecipeTag[],
): Promise<string[]> {
  const tagIds: string[] = [];
  const seen = new Set<string>();

  for (const tagName of tagNames) {
    const matched = matchCanonicalTag(tagName, allTags);

    if (!matched) {
      const isIntentionalDrop = INTENTIONAL_DROPS.includes(tagName);
      const mapped = resolveNotionTag(tagName);

      if (isIntentionalDrop) {
        logger.info(`Tag "${tagName}" intentionally dropped — skipping`);
      } else if (mapped) {
        // Mapping exists but the canonical tag is missing from the DB. This
        // means the migration hasn't been applied or the seed is stale.
        logger.warn(
          `Mapped tag "${tagName}" -> ${mapped.slug} not found in DB — apply migration?`,
        );
      } else {
        logger.warn(
          `Unmapped tag "${tagName}" — add to NOTION_TAG_MAP or INTENTIONAL_DROPS`,
        );
      }
      continue;
    }

    if (!seen.has(matched.id)) {
      seen.add(matched.id);
      tagIds.push(matched.id);
    }
  }

  return tagIds;
}

/** Resolve a Notion tag string to a canonical DB tag.
 *  Order: NOTION_TAG_MAP slug -> canonical en/es display name. */
function matchCanonicalTag(
  tagName: string,
  allTags: DbRecipeTag[],
): DbRecipeTag | null {
  const mapped = resolveNotionTag(tagName);
  if (mapped) {
    return matchTagBySlug(mapped.slug, allTags);
  }

  return matchTag(tagName, allTags);
}

/** Resolve kitchen tools: match existing or create new ones */
async function resolveKitchenTools(
  parsed: ParsedRecipeData,
  allItems: DbKitchenTool[],
): Promise<{
  items: Array<
    {
      kitchen_tool_id: string;
      display_order: number;
      notes_en: string;
      notes_es: string;
    }
  >;
  newlyCreatedTools: Array<{ id: string; nameEs: string }>;
}> {
  const items: Array<
    {
      kitchen_tool_id: string;
      display_order: number;
      notes_en: string;
      notes_es: string;
    }
  > = [];
  const newlyCreatedTools: Array<{ id: string; nameEs: string }> = [];

  for (const item of parsed.kitchenTools) {
    let matched = matchKitchenTool(item, allItems);

    if (!matched) {
      logger.info(
        `Creating missing kitchen tool: ${item.nameEn} / ${item.nameEs}`,
      );
      matched = await db.createKitchenTool(config.supabase, {
        name_en: item.nameEn,
        name_es: item.nameEs,
      });
      allItems.push(matched);
      newlyCreatedTools.push({ id: matched.id, nameEs: item.nameEs });
    }

    items.push({
      kitchen_tool_id: matched.id,
      display_order: item.displayOrder,
      notes_en: item.notesEn || '',
      notes_es: item.notesEs || '',
    });
  }

  return { items, newlyCreatedTools };
}

// ─── Main Import Flow ────────────────────────────────────

async function importRecipe(
  markdown: string,
  filename: string,
  allIngredients: DbIngredient[],
  allTags: DbRecipeTag[],
  allItems: DbKitchenTool[],
  allUnits: DbMeasurementUnit[],
): Promise<string> {
  // 1. Parse markdown with OpenAI
  const parsed = await parseRecipe(
    markdown,
    config.openaiApiKey,
    logger,
  );

  // Validate critical data
  if (!parsed.steps || parsed.steps.length === 0) {
    throw new Error(
      `Recipe "${parsed.nameEn}" has no steps — skipping to avoid incomplete data`,
    );
  }
  if (!parsed.ingredients || parsed.ingredients.length === 0) {
    throw new Error(
      `Recipe "${parsed.nameEn}" has no ingredients — skipping to avoid incomplete data`,
    );
  }

  // 2. Check for duplicate
  if (skipExisting && !dryRun) {
    const existingId = await db.findRecipeByName(
      config.supabase,
      parsed.nameEn,
      parsed.nameEs,
    );
    if (existingId) {
      logger.warn(
        `Skipping existing recipe: "${parsed.nameEn}" (${existingId})`,
      );
      return existingId;
    }
  }

  // 3. Resolve all entities (matching only — no DB writes in dry-run)
  const ingredientResult = dryRun
    ? {
      ...(await resolveIngredientsDry(parsed, allIngredients, allUnits)),
      newlyCreatedIngredients: [],
    }
    : await resolveIngredients(parsed, allIngredients, allUnits);
  const { recipeIngredients, ingredientMap, newlyCreatedIngredients } = ingredientResult;
  const tagIds = dryRun
    ? await resolveTagsDry(parsed.tags, allTags)
    : await resolveTags(parsed.tags, allTags);
  const kitchenToolResult = dryRun
    ? {
      items: await resolveKitchenToolsDry(parsed, allItems),
      newlyCreatedTools: [],
    }
    : await resolveKitchenTools(parsed, allItems);
  const { items: kitchenTools, newlyCreatedTools } = kitchenToolResult;

  // In dry-run mode: log everything and return without DB writes
  if (dryRun) {
    logger.info('--- DRY RUN OUTPUT ---');
    logger.info(`Name (EN): ${parsed.nameEn}`);
    logger.info(`Name (ES): ${parsed.nameEs}`);
    logger.info(
      `Difficulty: ${parsed.difficulty} | Prep: ${parsed.prepTime}min | Total: ${parsed.totalTime}min | Portions: ${parsed.portions}`,
    );
    logger.info(`Tags (${parsed.tags.length}): ${parsed.tags.join(', ')}`);
    logger.info(`Ingredients (${parsed.ingredients.length}):`);
    for (const ing of parsed.ingredients) {
      logger.info(
        `  - ${ing.quantity} ${
          ing.measurementUnitID || ''
        } ${ing.ingredient.nameEn} / ${ing.ingredient.nameEs}`,
      );
    }
    logger.info(`Steps (${parsed.steps.length}):`);
    for (const step of parsed.steps) {
      const tmx = step.thermomixTime
        ? ` [TM: ${step.thermomixTime}s ${
          step.thermomixTemperature ? step.thermomixTemperature + '°' : ''
        } vel${step.thermomixSpeed?.type === 'single' ? step.thermomixSpeed.value : '?'}]`
        : '';
      logger.info(`  ${step.order}. ${step.instructionEn}${tmx}`);
    }
    logger.info(
      `Kitchen tools (${parsed.kitchenTools.length}): ${
        parsed.kitchenTools.map((i) => i.nameEn).join(', ')
      }`,
    );
    if (parsed.tipsAndTricksEn) logger.info(`Tips: ${parsed.tipsAndTricksEn}`);

    // Meal planning fields — labels match DB column names so the dry-run
    // output reads exactly like the row that would be written.
    logger.info('Meal planning:');
    const mealPlanningLines = [
      `planner_role: ${parsed.plannerRole ?? 'null'}`,
      `equipment_tags: [${parsed.equipmentTags.join(', ')}]`,
      `meal_components: [${parsed.mealComponents.join(', ')}]`,
      `is_complete_meal: ${parsed.isCompleteMeal}`,
      `cooking_level: ${parsed.cookingLevel ?? 'null'}`,
      `leftovers_friendly: ${parsed.leftoversFriendly ?? 'null'}`,
      `max_household_size_supported: ${parsed.maxHouseholdSizeSupported ?? 'null'}`,
      `batch_friendly: ${parsed.batchFriendly ?? 'null'}`,
    ];
    for (const line of mealPlanningLines) logger.info(`  ${line}`);

    // Show entity resolution status
    const missingIngredients = parsed.ingredients.filter(
      (i) =>
        !allIngredients.some(
          (db) =>
            (db.name_en?.toLowerCase() ?? '') ===
              i.ingredient.nameEn.toLowerCase() ||
            (db.name_es?.toLowerCase() ?? '') ===
              i.ingredient.nameEs.toLowerCase(),
        ),
    );
    const missingTags = parsed.tags.filter((tag) =>
      !matchCanonicalTag(tag, allTags) && !INTENTIONAL_DROPS.includes(tag)
    );
    const missingItems = parsed.kitchenTools.filter(
      (i) => !allItems.some((db) => (db.name_en?.toLowerCase() ?? '') === i.nameEn.toLowerCase()),
    );

    if (missingIngredients.length > 0) {
      logger.warn(
        `Would create ${missingIngredients.length} new ingredient(s): ${
          missingIngredients.map((i) => i.ingredient.nameEn).join(', ')
        }`,
      );
    }
    if (missingTags.length > 0) {
      logger.warn(
        `Would skip ${missingTags.length} non-canonical tag(s): ${missingTags.join(', ')}`,
      );
    }
    if (missingItems.length > 0) {
      logger.warn(
        `Would create ${missingItems.length} new kitchen tool(s): ${
          missingItems.map((i) => i.nameEn).join(', ')
        }`,
      );
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
    planner_role: parsed.plannerRole,
    equipment_tags: parsed.equipmentTags,
    meal_components: parsed.mealComponents,
    is_complete_meal: parsed.isCompleteMeal,
    cooking_level: parsed.cookingLevel,
    leftovers_friendly: parsed.leftoversFriendly,
    max_household_size_supported: parsed.maxHouseholdSizeSupported,
    batch_friendly: parsed.batchFriendly,
  });

  logger.info(`Created recipe: ${recipeId}`);

  // Wrap child inserts so we can clean up the recipe on failure
  try {
    // 5. Insert recipe ingredients
    const ingredientsWithRecipeId = recipeIngredients.map((ri) => ({
      ...ri,
      recipe_id: recipeId,
    }));
    const ingredientOrderToId = await db.insertRecipeIngredients(
      config.supabase,
      ingredientsWithRecipeId,
    );

    // 6. Insert recipe steps
    const steps = buildRecipeSteps(recipeId, parsed);
    const insertedSteps = await db.insertRecipeSteps(config.supabase, steps);

    // 7. Insert step ingredients
    const { items: stepIngredients, unresolved } = resolveStepIngredients(
      parsed,
      insertedSteps,
      ingredientMap,
      allIngredients,
      allUnits,
    );

    if (unresolved.length > 0) {
      const preview = unresolved
        .slice(0, 3)
        .map((item) => `[step ${item.stepOrder}] ${item.ingredientNameEn || item.ingredientNameEs}`)
        .join(', ');
      logger.warn(
        `${unresolved.length} unresolved step-ingredient link(s) for "${parsed.nameEs}" (${preview}) — importing without them`,
      );
    }

    await db.insertRecipeStepIngredients(config.supabase, stepIngredients);

    // 8. Insert tags
    await db.insertRecipeTags(config.supabase, recipeId, tagIds);

    // 9. Insert kitchen tools
    await db.insertRecipeKitchenTools(config.supabase, recipeId, kitchenTools);

    // 10. Generate and insert es-ES (Spain Spanish) translations
    const spainInput = {
      recipeName: parsed.nameEs,
      tipsAndTricks: parsed.tipsAndTricksEs || '',
      steps: parsed.steps.map((s) => ({
        order: s.order,
        instruction: s.instructionEs,
        section: s.recipeSectionEs || 'Principal',
        tip: s.tipEs || '',
      })),
      ingredientNotes: parsed.ingredients.map((i) => ({
        displayOrder: i.displayOrder,
        notes: i.notesEs || '',
        tip: i.tipEs || '',
        section: i.recipeSectionEs || 'Principal',
      })),
      newIngredients: newlyCreatedIngredients.map((i) => ({
        name: i.nameEs,
        pluralName: i.pluralNameEs,
      })),
      newKitchenTools: newlyCreatedTools.map((kt) => ({
        name: kt.nameEs,
      })),
    };

    const spainOutput = await adaptToSpainSpanish(
      spainInput,
      config.openaiApiKey,
      logger,
    );

    // Build step ID mapping (order → DB id)
    const stepOrderToId = new Map(insertedSteps.map((s) => [s.order, s.id]));

    await db.insertSpainTranslations(config.supabase, {
      recipe: {
        recipeId,
        name: spainOutput.recipeName || parsed.nameEs,
        tipsAndTricks: spainOutput.tipsAndTricks || parsed.tipsAndTricksEs ||
          '',
      },
      steps: (() => {
        const mapped = (spainOutput.steps || []).map((s) => ({
          stepId: stepOrderToId.get(s.order) || '',
          instruction: s.instruction,
          section: s.section,
          tip: s.tip,
        }));
        const dropped = mapped.filter((s) => !s.stepId).length;
        if (dropped) {
          logger.warn(
            `es-ES: ${dropped} step(s) dropped — order mismatch with inserted steps`,
          );
        }
        return mapped.filter((s) => s.stepId);
      })(),
      ingredientNotes: (() => {
        const mapped = (spainOutput.ingredientNotes || []).map((ri) => ({
          recipeIngredientId: ingredientOrderToId.get(ri.displayOrder) || '',
          notes: ri.notes,
          tip: ri.tip,
          section: ri.section,
        }));
        const dropped = mapped.filter((ri) => !ri.recipeIngredientId).length;
        if (dropped) {
          logger.warn(
            `es-ES: ${dropped} ingredient note(s) dropped — displayOrder mismatch`,
          );
        }
        return mapped.filter((ri) => ri.recipeIngredientId);
      })(),
      ingredients: (() => {
        // Match by name instead of positional index to avoid silent corruption
        // if AI returns items in a different order
        const nameToIngredient = new Map(
          newlyCreatedIngredients.map((i) => [i.nameEs.toLowerCase(), i]),
        );
        return (spainOutput.newIngredients || []).map((i) => {
          const match = nameToIngredient.get(i.name.toLowerCase());
          return {
            ingredientId: match?.id || '',
            name: i.name,
            pluralName: i.pluralName,
          };
        }).filter((i) => i.ingredientId);
      })(),
      kitchenTools: (() => {
        const nameToTool = new Map(
          newlyCreatedTools.map((kt) => [kt.nameEs.toLowerCase(), kt]),
        );
        return (spainOutput.newKitchenTools || []).map((kt) => {
          const match = nameToTool.get(kt.name.toLowerCase());
          return {
            kitchenToolId: match?.id || '',
            name: kt.name,
          };
        }).filter((kt) => kt.kitchenToolId);
      })(),
    });
  } catch (childError) {
    // Clean up the orphaned recipe row (FK cascades delete children)
    logger.warn(
      `Cleaning up partial recipe "${parsed.nameEn}" (${recipeId}) after error`,
    );
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
): Promise<
  {
    recipeIngredients: db.RecipeIngredientInsert[];
    ingredientMap: Map<string, DbIngredient>;
  }
> {
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

function resolveTagsDry(
  tagNames: string[],
  allTags: DbRecipeTag[],
): Promise<string[]> {
  return Promise.resolve(
    tagNames
      .map((name) => matchCanonicalTag(name, allTags)?.id)
      .filter((id): id is string => id !== undefined),
  );
}

function resolveKitchenToolsDry(
  parsed: ParsedRecipeData,
  allItems: DbKitchenTool[],
): Promise<
  Array<
    {
      kitchen_tool_id: string;
      display_order: number;
      notes_en: string;
      notes_es: string;
    }
  >
> {
  return Promise.resolve(
    parsed.kitchenTools
      .map((item, i) => {
        const matched = matchKitchenTool(item, allItems);
        return matched
          ? {
            kitchen_tool_id: matched.id,
            display_order: i,
            notes_en: '',
            notes_es: '',
          }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  );
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  logger.section(`Recipe Import (${env})${dryRun ? ' [DRY RUN]' : ''}`);
  if (dryRun) {
    logger.warn('Dry-run mode: no data will be written to the database');
  }

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
    db.fetchAllKitchenTools(config.supabase),
    db.fetchAllMeasurementUnits(config.supabase),
  ]);

  logger.info(
    `Loaded: ${allIngredients.length} ingredients, ${allTags.length} tags, ${allItems.length} kitchen tools, ${allUnits.length} measurement units`,
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
  logger.info(
    `Ready to import: ${pending.length}${limit !== Infinity ? ` (limit: ${limit})` : ''}`,
  );

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

  for (let fileIdx = 0; fileIdx < toProcess.length; fileIdx++) {
    const file = toProcess[fileIdx];
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
      logger.success(
        `${dryRun ? 'Parsed' : 'Imported'} "${file.filename}"${dryRun ? '' : ` -> ${recipeId}`}`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        `Failed to ${dryRun ? 'parse' : 'import'} "${file.filename}": ${msg}`,
      );
      if (!dryRun) tracker.markFailed(file.filename, msg);
      failCount++;
    }

    // Small delay between OpenAI calls
    if (fileIdx < toProcess.length - 1) await sleep(500);
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
    'Kitchen tools in DB': allItems.length,
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
