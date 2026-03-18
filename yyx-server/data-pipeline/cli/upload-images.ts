#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env
/**
 * Upload Ingredient Images
 *
 * Uploads PNG images from a folder to Supabase storage and links them
 * to database ingredients. For each image: matches or creates the
 * ingredient, uploads the image, and optionally backfills translations
 * and nutrition.
 *
 * Usage:
 *   deno task pipeline:upload-images --local --dir /path/to/images --dry-run
 *   deno task pipeline:upload-images --local --dir /path/to/images --limit 10
 *   deno task pipeline:upload-images --local --dir /path/to/images --force
 */

import { createPipelineConfig, hasFlag, parseEnvironment, parseFlag } from '../lib/config.ts';
import { Logger } from '../lib/logger.ts';
import * as db from '../lib/db.ts';
import { matchIngredient } from '../lib/entity-matcher.ts';
import type { DbIngredient } from '../lib/entity-matcher.ts';
import { normalizeFileName } from '../lib/image-manifest.ts';
import { extractIngredientName } from '../lib/upload-helpers.ts';
import { parseJsonFromLLM, sleep } from '../lib/utils.ts';
import { callOpenAI, fetchNutritionFromOpenAI } from '../lib/openai-client.ts';
import type { NutritionData } from '../lib/openai-client.ts';

const logger = new Logger('upload-images');
const env = parseEnvironment(Deno.args);
const config = createPipelineConfig(env);

const dirPath = parseFlag(Deno.args, '--dir');
const limit = parseInt(parseFlag(Deno.args, '--limit', '50') || '50', 10);
const dryRun = hasFlag(Deno.args, '--dry-run');
const force = hasFlag(Deno.args, '--force');
const skipNutrition = hasFlag(Deno.args, '--skip-nutrition');

if (!dirPath) {
  logger.error('--dir <path> is required');
  Deno.exit(1);
}

// ─── Helpers (using shared OpenAI retry wrapper) ─────────

/** Detect language and translate ingredient name + plurals using gpt-4.1-mini */
async function translateIngredient(
  name: string,
): Promise<{ name_en: string; name_es: string; plural_en: string; plural_es: string } | null> {
  if (!config.openaiApiKey) {
    logger.warn('No OpenAI API key — cannot translate');
    return null;
  }

  const content = await callOpenAI({
    apiKey: config.openaiApiKey,
    model: 'gpt-4.1-mini',
    messages: [{
      role: 'user',
      content:
        `You are a bilingual food/ingredient translator (English ↔ Spanish). Given the ingredient name "${name}", detect its language and provide translations. Return ONLY a JSON object: {"name_en": "english name", "name_es": "spanish name", "plural_en": "english plural", "plural_es": "spanish plural"}. Use lowercase except for proper nouns. If the name is already English, still provide the Spanish translation and vice versa.`,
    }],
    temperature: 0.2,
    logger,
    label: name,
  });

  if (!content) return null;

  try {
    const parsed = parseJsonFromLLM(content) as Record<string, unknown> | null;
    if (
      !parsed ||
      typeof parsed.name_en !== 'string' ||
      typeof parsed.name_es !== 'string' ||
      typeof parsed.plural_en !== 'string' ||
      typeof parsed.plural_es !== 'string'
    ) {
      logger.warn(`Invalid translation response for "${name}": ${content}`);
      return null;
    }

    return {
      name_en: parsed.name_en as string,
      name_es: parsed.name_es as string,
      plural_en: parsed.plural_en as string,
      plural_es: parsed.plural_es as string,
    };
  } catch {
    logger.warn(`Failed to parse translation JSON for "${name}": ${content}`);
    return null;
  }
}

/** Fetch nutrition per 100g using the shared OpenAI nutrition helper */
async function fetchNutrition(ingredientName: string): Promise<NutritionData | null> {
  if (!config.openaiApiKey) return null;
  return fetchNutritionFromOpenAI(ingredientName, config.openaiApiKey, logger);
}

/** Upload an image file to Supabase storage */
async function uploadImageToStorage(
  filePath: string,
  storagePath: string,
): Promise<string> {
  const fileData = await Deno.readFile(filePath);

  const { error } = await config.supabase.storage
    .from('ingredients')
    .upload(storagePath, fileData, {
      contentType: 'image/png',
      upsert: force,
    });

  if (error) throw new Error(`Storage upload failed for ${storagePath}: ${error.message}`);

  const { data: urlData } = config.supabase.storage
    .from('ingredients')
    .getPublicUrl(storagePath);

  return urlData.publicUrl;
}

/** Update ingredient's image_url in the database */
async function updateIngredientImageUrl(
  ingredientId: string,
  imageUrl: string,
): Promise<void> {
  const { error } = await config.supabase
    .from('ingredients')
    .update({ image_url: imageUrl })
    .eq('id', ingredientId);
  if (error) throw new Error(`Failed to update image_url for ${ingredientId}: ${error.message}`);
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  logger.section(`Upload Ingredient Images (${env})`);

  // Validate directory
  let dirEntries: Deno.DirEntry[];
  try {
    dirEntries = [];
    for await (const entry of Deno.readDir(dirPath!)) {
      if (entry.isFile && entry.name.toLowerCase().endsWith('.png')) {
        dirEntries.push(entry);
      }
    }
  } catch (e) {
    logger.error(`Cannot read directory "${dirPath}": ${e}`);
    Deno.exit(1);
  }

  dirEntries.sort((a, b) => a.name.localeCompare(b.name));
  logger.info(`Found ${dirEntries.length} PNG files in ${dirPath}`);

  if (dirEntries.length === 0) {
    logger.warn('No PNG files found. Nothing to do.');
    return;
  }

  // Fetch DB state
  const [allIngredients, nutritionIds] = await Promise.all([
    db.fetchAllIngredients(config.supabase),
    db.fetchIngredientNutritionIds(config.supabase),
  ]);

  // Mutable local cache of ingredients (grows as we create new ones)
  const ingredientCache: DbIngredient[] = [...allIngredients];

  const toProcess = dirEntries.slice(0, limit);
  logger.info(
    `Processing ${toProcess.length} of ${dirEntries.length} files (limit: ${limit})`,
  );

  if (dryRun) {
    logger.warn('DRY RUN - no changes will be made');
    for (const entry of toProcess) {
      const name = extractIngredientName(entry.name);
      const match = matchIngredient({ nameEn: name, nameEs: name }, ingredientCache);
      const status = match
        ? (match.image_url && !force ? 'SKIP (has image)' : `MATCH: ${match.name_en}`)
        : 'NEW (would create)';
      logger.info(`  ${entry.name} → "${name}" → ${status}`);
    }
    return;
  }

  let uploaded = 0;
  let skipped = 0;
  let created = 0;
  let nutritionCount = 0;
  let failCount = 0;

  for (const entry of toProcess) {
    const name = extractIngredientName(entry.name);
    const filePath = `${dirPath}/${entry.name}`;
    logger.info(`Processing: ${entry.name} → "${name}"`);

    try {
      // 1. Match or create ingredient
      let ingredient = matchIngredient({ nameEn: name, nameEs: name }, ingredientCache);

      if (!ingredient) {
        // Translate to get both EN and ES names
        logger.info(`  No match — translating "${name}"...`);
        const translation = await translateIngredient(name);
        if (!translation) {
          logger.error(`  Failed to translate "${name}" — skipping`);
          failCount++;
          await sleep(300);
          continue;
        }

        logger.info(
          `  Translated: EN="${translation.name_en}" ES="${translation.name_es}"`,
        );

        // Create the ingredient
        ingredient = await db.createIngredient(config.supabase, {
          name_en: translation.name_en,
          name_es: translation.name_es,
          plural_name_en: translation.plural_en,
          plural_name_es: translation.plural_es,
        });

        // Add to local cache to prevent duplicates within this run
        ingredientCache.push(ingredient);
        created++;
        logger.success(`  Created ingredient: ${ingredient.name_en} (${ingredient.id})`);
      } else {
        logger.info(`  Matched: ${ingredient.name_en} / ${ingredient.name_es} (${ingredient.id})`);
      }

      // 2. Upload image (skip if already has one and not --force)
      if (ingredient.image_url && !force) {
        logger.info(`  Already has image — skipping upload (use --force to overwrite)`);
        skipped++;
      } else {
        const normalized = normalizeFileName(ingredient.name_en || ingredient.name_es);
        const storagePath = `images/${normalized}.png`;

        logger.info(`  Uploading to ingredients/${storagePath}...`);
        const publicUrl = await uploadImageToStorage(filePath, storagePath);
        await updateIngredientImageUrl(ingredient.id, publicUrl);

        // Update local cache
        ingredient.image_url = publicUrl;
        logger.success(`  Uploaded: ${publicUrl}`);
        uploaded++;
      }

      // 3. Nutrition (unless skipped or already has it)
      if (!skipNutrition && !nutritionIds.has(ingredient.id)) {
        const nutritionName = ingredient.name_en || ingredient.name_es;
        logger.info(`  Fetching nutrition for "${nutritionName}"...`);
        const nutrition = await fetchNutrition(nutritionName);
        if (nutrition) {
          await db.upsertIngredientNutrition(config.supabase, ingredient.id, {
            ...nutrition,
            source: 'openai:gpt-4.1-mini',
          });
          nutritionIds.add(ingredient.id);
          nutritionCount++;
          logger.success(
            `  Nutrition: ${nutrition.calories} cal, ${nutrition.protein}g P, ${nutrition.fat}g F, ${nutrition.carbohydrates}g C`,
          );
        } else {
          logger.warn(`  Could not fetch nutrition for "${nutritionName}"`);
        }
      }

      // Rate limit between items
      await sleep(500);
    } catch (error) {
      logger.error(`  Failed for ${entry.name}: ${error}`);
      failCount++;
      await sleep(300);
    }
  }

  logger.summary({
    'PNG files found': dirEntries.length,
    'Processed': toProcess.length,
    'Images uploaded': uploaded,
    'Images skipped (existing)': skipped,
    'Ingredients created': created,
    'Nutrition backfilled': nutritionCount,
    'Failed': failCount,
  });
}

main().catch((error) => {
  logger.error('Fatal error', error);
  Deno.exit(1);
});
