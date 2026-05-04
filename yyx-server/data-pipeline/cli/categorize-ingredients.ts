#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env
/**
 * Categorize Ingredients
 *
 * Reads every ingredient and asks gpt-4.1-nano to assign each one to a
 * shopping_list_categories ID. Writes a SQL backfill file the user reviews
 * and then commits as a migration.
 *
 * Usage:
 *   deno task pipeline:categorize-ingredients --local
 *   deno task pipeline:categorize-ingredients --production --limit 50
 *   deno task pipeline:categorize-ingredients --local --only-missing
 *
 * Output: yyx-server/data-pipeline/data/ingredient-categories.sql
 *
 * Why a SQL file instead of writing directly:
 *   - Human-reviewable in PR diff before running against the DB.
 *   - Reproducible — the exact same statements can be replayed in staging.
 *   - Migration workflow expects SQL files; once you're happy, move it
 *     into supabase/migrations/<timestamp>_seed_ingredient_default_category.sql
 *     and run `npm run db:push`.
 */

import { createPipelineConfig, hasFlag, parseEnvironment, parseFlag } from '../lib/config.ts';
import { Logger } from '../lib/logger.ts';
import * as db from '../lib/db.ts';
import { callOpenAI, type CallOpenAIOptions } from '../lib/openai-client.ts';
import { parseJsonFromLLM, sleep } from '../lib/utils.ts';

const CATEGORY_IDS = [
  'produce',
  'dairy',
  'meat',
  'bakery',
  'pantry',
  'frozen',
  'beverages',
  'snacks',
  'spices',
  'household',
  'personal',
  'other',
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

const SYSTEM_PROMPT =
  `You are categorizing grocery ingredients into a fixed set of shopping list categories.

Categories:
- produce: fruits, vegetables, fresh herbs, mushrooms
- dairy: milk, cream, yogurt, cheese, butter, eggs
- meat: beef, pork, poultry, fish, seafood, deli meat, sausages
- bakery: bread, pastries, tortillas, baked goods
- pantry: flour, sugar, oil, rice, pasta, canned goods, beans, lentils, baking ingredients, broths, sauces, condiments (peanut butter, jam)
- frozen: anything sold frozen
- beverages: water, juice, soda, coffee, tea, alcoholic drinks, milk alternatives sold as beverages
- snacks: chips, cookies, crackers, candy, chocolate
- spices: dried herbs and spices, salt, pepper, seasoning blends, vanilla extract
- household: cleaning supplies, paper goods, kitchen disposables
- personal: toiletries, hygiene
- other: anything that doesn't clearly fit elsewhere

Rules:
- Pick the SINGLE best category for each ingredient.
- Use "pantry" for shelf-stable cooking staples that don't have a more specific home.
- Use "spices" only for dried/ground seasoning, not fresh herbs (those are produce).
- Use "other" sparingly — only when an ingredient genuinely doesn't fit any specific category.
- Names may be in English, Spanish, or both. Use whichever is provided to make the call.`;

export interface IngredientForLLM {
  id: string;
  name_en: string;
  name_es: string;
}

interface CategoryAssignment {
  id: string;
  category_id: CategoryId;
}

function isValidCategory(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value);
}

type CategorizeOpenAICall = (options: CallOpenAIOptions) => Promise<string | null>;

export async function categorizeBatch(
  batch: IngredientForLLM[],
  options: {
    apiKey?: string;
    logger?: Logger;
    callOpenAI?: CategorizeOpenAICall;
  } = {},
): Promise<Map<string, CategoryId>> {
  const activeLogger = options.logger ?? new Logger('categorize-ingredients');
  const call = options.callOpenAI ?? callOpenAI;
  const userMsg = [
    'Categorize each of these ingredients. Return ONLY a JSON object with shape',
    '{"assignments": [{"id": string, "category_id": string}, …]}.',
    'category_id must be one of: ' + CATEGORY_IDS.join(', '),
    '',
    'Ingredients:',
    ...batch.map((ing) => `- id=${ing.id} | en="${ing.name_en}" | es="${ing.name_es}"`),
  ].join('\n');

  const content = await call({
    apiKey: options.apiKey ?? '',
    model: 'gpt-4.1-nano',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMsg },
    ],
    temperature: 0.1,
    logger: activeLogger,
    label: `batch of ${batch.length}`,
  });

  const result = new Map<string, CategoryId>();
  if (!content) {
    activeLogger.warn(`No content returned for batch of ${batch.length} — falling back to "other"`);
    for (const ing of batch) result.set(ing.id, 'other');
    return result;
  }

  const parsed = parseJsonFromLLM(content) as { assignments?: CategoryAssignment[] } | null;
  const assignments = parsed?.assignments ?? [];
  for (const a of assignments) {
    if (typeof a?.id !== 'string') continue;
    if (!isValidCategory(a.category_id)) {
      activeLogger.warn(`Invalid category "${a.category_id}" for id=${a.id} — using "other"`);
      result.set(a.id, 'other');
      continue;
    }
    result.set(a.id, a.category_id);
  }

  // Anything the model didn't return — fall back to "other" so we don't
  // silently drop rows.
  for (const ing of batch) {
    if (!result.has(ing.id)) {
      activeLogger.warn(`Missing assignment for id=${ing.id} (${ing.name_en}) — using "other"`);
      result.set(ing.id, 'other');
    }
  }

  return result;
}

function escapeSqlIdentifier(value: string): string {
  return value.replace(/'/g, "''");
}

function sanitizeForSqlComment(value: string): string {
  return value.replace(/[\r\n]+/g, ' ');
}

function buildSqlFile(
  assignments: Array<{ ingredient: IngredientForLLM; category: CategoryId }>,
  env: string,
): string {
  const lines: string[] = [];
  lines.push('-- Generated by data-pipeline/cli/categorize-ingredients.ts');
  lines.push(`-- Generated at: ${new Date().toISOString()}`);
  lines.push(`-- Environment: ${env}`);
  lines.push(`-- Ingredient count: ${assignments.length}`);
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  for (const { ingredient, category } of assignments) {
    const enComment = sanitizeForSqlComment(
      escapeSqlIdentifier(ingredient.name_en || ingredient.name_es || ''),
    );
    lines.push(
      `UPDATE public.ingredients SET default_category_id = '${category}' WHERE id = '${ingredient.id}'; -- ${enComment}`,
    );
  }

  lines.push('');
  lines.push('COMMIT;');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const logger = new Logger('categorize-ingredients');
  const env = parseEnvironment(Deno.args);
  const config = createPipelineConfig(env);
  const limit = parseInt(parseFlag(Deno.args, '--limit', '0') || '0', 10);
  const batchSize = parseInt(parseFlag(Deno.args, '--batch-size', '40') || '40', 10);
  const onlyMissing = hasFlag(Deno.args, '--only-missing');

  logger.section(`Categorize Ingredients (${env})`);

  const all = await db.fetchAllIngredients(config.supabase);
  logger.info(`Loaded ${all.length} ingredients`);

  let pool = all;
  if (onlyMissing) {
    const { data, error } = await config.supabase
      .from('ingredients')
      .select('id, default_category_id');
    if (error) {
      logger.error(`Failed to read existing categories: ${error.message}`);
      Deno.exit(1);
    }
    const alreadySet = new Set(
      (data || []).filter((r: any) => r.default_category_id).map((r: any) => r.id),
    );
    pool = pool.filter((ing) => !alreadySet.has(ing.id));
    logger.info(
      `Skipping ${all.length - pool.length} already-categorized; ${pool.length} remaining`,
    );
  }

  if (limit > 0 && pool.length > limit) {
    logger.info(`Limiting to first ${limit} ingredients`);
    pool = pool.slice(0, limit);
  }

  if (pool.length === 0) {
    logger.info('Nothing to categorize.');
    return;
  }

  const forLLM: IngredientForLLM[] = pool.map((ing) => ({
    id: ing.id,
    name_en: ing.name_en,
    name_es: ing.name_es,
  }));

  const all_assignments: Array<{ ingredient: IngredientForLLM; category: CategoryId }> = [];
  for (let i = 0; i < forLLM.length; i += batchSize) {
    const batch = forLLM.slice(i, i + batchSize);
    logger.info(`Categorizing batch ${i + 1}–${i + batch.length} of ${forLLM.length}`);
    const assignments = await categorizeBatch(batch, {
      apiKey: config.openaiApiKey,
      logger,
    });
    for (const ing of batch) {
      all_assignments.push({ ingredient: ing, category: assignments.get(ing.id) ?? 'other' });
    }
    if (i + batchSize < forLLM.length) await sleep(500);
  }

  const sql = buildSqlFile(all_assignments, env);
  const outPath = new URL('../data/ingredient-categories.sql', import.meta.url);
  await Deno.mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await Deno.writeTextFile(outPath, sql);
  logger.success(`Wrote ${all_assignments.length} UPDATEs to ${outPath.pathname}`);

  // Print a small distribution summary to make obvious mis-categorizations easy to eyeball.
  const counts = new Map<CategoryId, number>();
  for (const a of all_assignments) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  logger.section('Distribution');
  for (const [cat, n] of sorted) logger.info(`  ${cat.padEnd(10)} ${n}`);
}

if (import.meta.main) {
  await main();
}
