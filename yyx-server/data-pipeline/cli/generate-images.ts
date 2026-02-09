#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env
/**
 * Generate Missing Images with DALL-E 3
 *
 * Generates AI images for recipes, ingredients, and useful items
 * that are missing pictures, then uploads to Supabase Storage.
 *
 * Usage:
 *   deno task pipeline:images --local --type ingredient --limit 5
 *   deno task pipeline:images --production --type all --limit 20
 *   deno task pipeline:images --local --type recipe --dry-run
 *
 * Flags:
 *   --type <type>   Entity type: recipe, ingredient, useful_item, all (default: all)
 *   --limit <n>     Max images to generate (default: 10)
 *   --dry-run       List what would be generated without generating
 */

import { createPipelineConfig, hasFlag, parseEnvironment, parseFlag } from '../lib/config.ts';
import { Logger } from '../lib/logger.ts';
import * as db from '../lib/db.ts';

const logger = new Logger('images');
const env = parseEnvironment(Deno.args);
const config = createPipelineConfig(env);

const entityType = parseFlag(Deno.args, '--type', 'all') || 'all';
const limitArg = parseInt(parseFlag(Deno.args, '--limit', '10') || '10', 10);
const dryRun = hasFlag(Deno.args, '--dry-run');

/** Shared budget so --limit N caps total images across all entity types */
const budget = { remaining: limitArg };

/** Resolve fallback directory relative to this file (matches .gitignore: data-pipeline/data/failed-uploads/) */
const failedUploadsDir = new URL('../data/failed-uploads', import.meta.url).pathname;

// ─── DALL-E Image Generation ─────────────────────────────

async function generateImage(prompt: string): Promise<Uint8Array> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DALL-E API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const imageUrl = data.data?.[0]?.url;
  if (!imageUrl) throw new Error('No image URL in DALL-E response');

  // Download the generated image
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Image download failed (${imageRes.status}): ${imageRes.statusText}`);
  }
  const contentType = imageRes.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Unexpected content-type from image download: ${contentType}`);
  }
  const arrayBuffer = await imageRes.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// ─── Upload to Supabase Storage ──────────────────────────

function normalizeFileName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

async function uploadToStorage(
  bucket: string,
  name: string,
  imageData: Uint8Array,
): Promise<string> {
  const timestamp = Date.now();
  const fileName = `${normalizeFileName(name)}_${timestamp}.png`;
  const path = `images/${fileName}`;

  const { error } = await config.supabase.storage
    .from(bucket)
    .upload(path, imageData, {
      contentType: 'image/png',
      upsert: false,
    });

  if (error) throw new Error(`Storage upload error: ${error.message}`);

  const { data } = config.supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// ─── Prompt Templates ────────────────────────────────────

function recipePrompt(name: string): string {
  return `A beautiful, appetizing overhead photo of "${name}" plated on a rustic wooden table. Food photography style, natural warm lighting, shallow depth of field, professional quality. The dish should look homemade and inviting.`;
}

function ingredientPrompt(name: string): string {
  return `A clean, professional product photo of fresh ${name} on a pure white background. Studio lighting, high quality food photography, isolated ingredient, no other objects. The ingredient should look fresh and vibrant.`;
}

function usefulItemPrompt(name: string): string {
  return `A clean product photo of a ${name} kitchen tool/utensil on a pure white background. Professional studio photography, isolated object, high quality, simple and clean composition.`;
}

// ─── Process Entities ────────────────────────────────────

async function processIngredients(): Promise<{ success: number; fail: number }> {
  const ingredients = await db.fetchAllIngredients(config.supabase);
  const missing = ingredients.filter((i) => !i.picture_url).slice(0, budget.remaining);

  logger.info(`Found ${missing.length} ingredients missing images`);
  let success = 0;
  let fail = 0;

  for (const ing of missing) {
    if (budget.remaining <= 0) break;
    const name = ing.name_en || ing.name_es;
    if (dryRun) {
      logger.info(`[DRY RUN] Would generate image for ingredient: ${name}`);
      budget.remaining--;
      continue;
    }

    try {
      logger.info(`Generating image for ingredient: ${name}`);
      const imageData = await generateImage(ingredientPrompt(name));
      try {
        const publicUrl = await uploadToStorage('ingredients', name, imageData);
        await db.updateIngredient(config.supabase, ing.id, { picture_url: publicUrl });
        logger.success(`Generated image for: ${name}`);
        success++;
      } catch (uploadError) {
        // Save locally so the DALL-E generation isn't wasted
        const fallbackPath = `${failedUploadsDir}/${normalizeFileName(name)}_${Date.now()}.png`;
        await Deno.mkdir(failedUploadsDir, { recursive: true });
        await Deno.writeFile(fallbackPath, imageData);
        logger.error(`Upload failed for "${name}", saved locally: ${fallbackPath}`);
        logger.error(`Upload error: ${uploadError}`);
        fail++;
      }
    } catch (error) {
      logger.error(`Failed for "${name}": ${error}`);
      fail++;
    }

    budget.remaining--;
    // Rate limit: ~5 images per minute for DALL-E 3
    await new Promise((r) => setTimeout(r, 15000));
  }

  return { success, fail };
}

async function processRecipes(): Promise<{ success: number; fail: number }> {
  const recipes = await db.fetchAllRecipes(config.supabase);
  const missing = recipes.filter((r) => !r.picture_url).slice(0, budget.remaining);

  logger.info(`Found ${missing.length} recipes missing images`);
  let success = 0;
  let fail = 0;

  for (const recipe of missing) {
    if (budget.remaining <= 0) break;
    const name = recipe.name_en || recipe.name_es;
    if (dryRun) {
      logger.info(`[DRY RUN] Would generate image for recipe: ${name}`);
      budget.remaining--;
      continue;
    }

    try {
      logger.info(`Generating image for recipe: ${name}`);
      const imageData = await generateImage(recipePrompt(name));
      try {
        const publicUrl = await uploadToStorage('recipes', name, imageData);
        await db.updateRecipe(config.supabase, recipe.id, { picture_url: publicUrl });
        logger.success(`Generated image for: ${name}`);
        success++;
      } catch (uploadError) {
        const fallbackPath = `${failedUploadsDir}/${normalizeFileName(name)}_${Date.now()}.png`;
        await Deno.mkdir(failedUploadsDir, { recursive: true });
        await Deno.writeFile(fallbackPath, imageData);
        logger.error(`Upload failed for "${name}", saved locally: ${fallbackPath}`);
        logger.error(`Upload error: ${uploadError}`);
        fail++;
      }
    } catch (error) {
      logger.error(`Failed for "${name}": ${error}`);
      fail++;
    }

    budget.remaining--;
    await new Promise((r) => setTimeout(r, 15000));
  }

  return { success, fail };
}

async function processUsefulItems(): Promise<{ success: number; fail: number }> {
  const items = await db.fetchAllUsefulItems(config.supabase);
  const missing = items.filter((i) => !i.picture_url).slice(0, budget.remaining);

  logger.info(`Found ${missing.length} useful items missing images`);
  let success = 0;
  let fail = 0;

  for (const item of missing) {
    if (budget.remaining <= 0) break;
    const name = item.name_en || item.name_es;
    if (dryRun) {
      logger.info(`[DRY RUN] Would generate image for useful item: ${name}`);
      budget.remaining--;
      continue;
    }

    try {
      logger.info(`Generating image for useful item: ${name}`);
      const imageData = await generateImage(usefulItemPrompt(name));
      try {
        const publicUrl = await uploadToStorage('useful-items', name, imageData);
        await db.updateUsefulItem(config.supabase, item.id, { picture_url: publicUrl });
        logger.success(`Generated image for: ${name}`);
        success++;
      } catch (uploadError) {
        const fallbackPath = `${failedUploadsDir}/${normalizeFileName(name)}_${Date.now()}.png`;
        await Deno.mkdir(failedUploadsDir, { recursive: true });
        await Deno.writeFile(fallbackPath, imageData);
        logger.error(`Upload failed for "${name}", saved locally: ${fallbackPath}`);
        logger.error(`Upload error: ${uploadError}`);
        fail++;
      }
    } catch (error) {
      logger.error(`Failed for "${name}": ${error}`);
      fail++;
    }

    budget.remaining--;
    await new Promise((r) => setTimeout(r, 15000));
  }

  return { success, fail };
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  logger.section(`Image Generation (${env})`);

  if (!config.openaiApiKey) {
    logger.error('OPENAI_API_KEY not configured. Cannot generate images.');
    Deno.exit(1);
  }

  if (dryRun) {
    logger.warn('DRY RUN MODE - no images will be generated');
  }

  let totalSuccess = 0;
  let totalFail = 0;

  if (entityType === 'ingredient' || entityType === 'all') {
    const result = await processIngredients();
    totalSuccess += result.success;
    totalFail += result.fail;
  }

  if (entityType === 'recipe' || entityType === 'all') {
    const result = await processRecipes();
    totalSuccess += result.success;
    totalFail += result.fail;
  }

  if (entityType === 'useful_item' || entityType === 'all') {
    const result = await processUsefulItems();
    totalSuccess += result.success;
    totalFail += result.fail;
  }

  logger.summary({
    'Images generated': totalSuccess,
    'Failed': totalFail,
  });
}

main().catch((error) => {
  logger.error('Fatal error', error);
  Deno.exit(1);
});
