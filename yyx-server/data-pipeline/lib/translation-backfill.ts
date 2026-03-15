/**
 * Translation Backfill Logic
 *
 * Fills missing translations for entities that have `es` but are missing
 * `en` or `es-ES`. Uses OpenAI gpt-4.1-mini for batch translation.
 *
 * Simple entities (ingredients, kitchen tools, tags) are batched 20 per call.
 * Complex entities (recipes with steps + ingredient notes) are 1 per call.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from './logger.ts';
import { parseJsonFromLLM, sleep } from './utils.ts';
import * as db from './db.ts';
import { adaptToSpainSpanish } from './spain-adapter.ts';

const BATCH_SIZE = 20;
const API_DELAY_MS = 500;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

// ─── Types ──────────────────────────────────────────────

export type SimpleEntityType = 'ingredients' | 'kitchen_tools' | 'tags';
export type EntityType = SimpleEntityType | 'recipes';
export type TargetLocale = 'en' | 'es-ES';

interface SimpleEntityConfig {
  translationTable: string;
  idColumn: string;
  fields: string[];
}

const SIMPLE_ENTITY_CONFIG: Record<SimpleEntityType, SimpleEntityConfig> = {
  ingredients: {
    translationTable: 'ingredient_translations',
    idColumn: 'ingredient_id',
    fields: ['name', 'plural_name'],
  },
  kitchen_tools: {
    translationTable: 'kitchen_tool_translations',
    idColumn: 'kitchen_tool_id',
    fields: ['name'],
  },
  tags: {
    translationTable: 'recipe_tag_translations',
    idColumn: 'recipe_tag_id',
    fields: ['name'],
  },
};

// ─── AI Translation ─────────────────────────────────────

const TRANSLATE_SYSTEM_PROMPT = `You translate cooking/recipe content from Spanish to English.

Rules:
- Translate ingredient names, kitchen tool names, recipe tags accurately
- Keep proper nouns (brand names like "Thermomix") unchanged
- For plural_name: provide the English plural form
- Return valid JSON matching the exact schema requested
- Preserve the "id" field exactly as given`;

// NOTE: Keep this swap list in sync with spain-adapter.ts SYSTEM_PROMPT
const ADAPT_SPAIN_SYSTEM_PROMPT = `You adapt Mexican Spanish recipe text to Spain Spanish (Castilian).

Rules:
- ONLY change words/phrases that differ between Mexican and Spain Spanish
- Common swaps: jitomate→tomate, ejotes→judías verdes, chícharos→guisantes, papa→patata, durazno→melocotón, elote→maíz, betabel→remolacha, frijoles→alubias, chile→pimiento/guindilla, crema→nata
- Keep Thermomix-specific terms unchanged (vaso, Varoma, vel, giro a la izquierda)
- Keep measurements unchanged (g, ml, min, seg)
- If the text is already neutral Spanish or doesn't need changes, return the EXACT same text
- Do NOT rewrite or rephrase — only swap region-specific words
- Return valid JSON matching the exact schema requested
- Preserve the "id" field exactly as given`;

interface BatchItem {
  id: string;
  [key: string]: string;
}

function buildBatchSchema(fields: string[]): Record<string, unknown> {
  const itemProps: Record<string, unknown> = {
    id: { type: 'string' },
  };
  for (const f of fields) {
    itemProps[f] = { type: 'string' };
  }
  return {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: itemProps,
          required: ['id', ...fields],
          additionalProperties: false,
        },
      },
    },
    required: ['items'],
    additionalProperties: false,
  };
}

async function callOpenAI(
  systemPrompt: string,
  userContent: string,
  schema: Record<string, unknown>,
  apiKey: string,
  maxTokens = 4000,
): Promise<unknown> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          temperature: 0.1,
          max_output_tokens: maxTokens,
          text: {
            format: {
              type: 'json_schema',
              name: 'TranslationBatch',
              schema,
            },
          },
          input: userContent,
          instructions: systemPrompt,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < MAX_RETRIES) {
          const backoffMs = BASE_BACKOFF_MS * (2 ** (attempt - 1));
          await sleep(backoffMs);
          continue;
        }
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const outputText = data.output_text || data.output?.[0]?.content?.[0]?.text;
      if (!outputText) throw new Error('No content in OpenAI response');
      return parseJsonFromLLM(outputText);
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const backoffMs = BASE_BACKOFF_MS * (2 ** (attempt - 1));
        await sleep(backoffMs);
        continue;
      }
      throw error;
    }
  }
  throw new Error('callOpenAI: exhausted retries');
}

/** Warn if the AI returned a different number of items than we sent */
function validateBatchCount(sent: number, received: number, context: string): void {
  if (sent !== received) {
    console.warn(
      `[backfill] WARNING: ${context} — sent ${sent} items but received ${received}. Some translations may be missing.`,
    );
  }
}

/**
 * Translate a batch of simple entities from es → en.
 */
async function translateBatchToEnglish(
  items: BatchItem[],
  fields: string[],
  apiKey: string,
): Promise<BatchItem[]> {
  const schema = buildBatchSchema(fields);
  const userPrompt = `Translate these items from Spanish to English:\n${JSON.stringify(items, null, 2)}`;
  const result = await callOpenAI(TRANSLATE_SYSTEM_PROMPT, userPrompt, schema, apiKey) as {
    items: BatchItem[];
  };
  validateBatchCount(items.length, result.items.length, 'es→en translation');
  return result.items;
}

/**
 * Adapt a batch of simple entities from es (MX) → es-ES.
 */
async function adaptBatchToSpain(
  items: BatchItem[],
  fields: string[],
  apiKey: string,
): Promise<BatchItem[]> {
  const schema = buildBatchSchema(fields);
  const userPrompt =
    `Adapt these items from Mexican Spanish to Spain Spanish (Castilian). Only change region-specific words:\n${
      JSON.stringify(items, null, 2)
    }`;
  const result = await callOpenAI(ADAPT_SPAIN_SYSTEM_PROMPT, userPrompt, schema, apiKey) as {
    items: BatchItem[];
  };
  validateBatchCount(items.length, result.items.length, 'es→es-ES adaptation');
  return result.items;
}

// ─── Simple Entity Backfill ─────────────────────────────

export async function backfillSimpleEntities(
  entityType: SimpleEntityType,
  supabase: SupabaseClient,
  apiKey: string,
  targetLocale: TargetLocale,
  logger: Logger,
  limit?: number,
  dryRun = false,
): Promise<{ found: number; processed: number }> {
  const config = SIMPLE_ENTITY_CONFIG[entityType];

  const missing = await db.fetchEntitiesMissingLocale(
    supabase,
    config.translationTable,
    config.idColumn,
    config.fields,
    'es', // source locale is always es
    targetLocale,
    limit,
  );

  logger.info(`${entityType}: ${missing.length} entities missing ${targetLocale} translations`);

  if (dryRun || missing.length === 0) {
    return { found: missing.length, processed: 0 };
  }

  let processed = 0;

  // Process in batches
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);

    // Build batch items with id + translatable fields
    const items: BatchItem[] = batch.map((row) => {
      const item: BatchItem = { id: row[config.idColumn] };
      for (const field of config.fields) {
        item[field] = row[field] || '';
      }
      return item;
    });

    logger.info(
      `  Translating batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(missing.length / BATCH_SIZE)} (${items.length} items)...`,
    );

    let translated: BatchItem[];
    if (targetLocale === 'en') {
      translated = await translateBatchToEnglish(items, config.fields, apiKey);
    } else {
      translated = await adaptBatchToSpain(items, config.fields, apiKey);
    }

    // Build upsert rows
    // deno-lint-ignore no-explicit-any
    const rows: Record<string, any>[] = translated.map((t) => {
      // deno-lint-ignore no-explicit-any
      const row: Record<string, any> = {
        [config.idColumn]: t.id,
        locale: targetLocale,
      };
      for (const field of config.fields) {
        row[field] = t[field] || '';
      }
      return row;
    });

    const { skipped } = await db.upsertEntityTranslations(
      supabase, config.translationTable, config.idColumn, rows,
    );
    processed += rows.length - skipped;
    if (skipped > 0) {
      logger.warn(`  Skipped ${skipped} rows due to name conflicts`);
    }
    logger.success(
      `  Upserted ${rows.length - skipped} ${targetLocale} translations for ${entityType}`,
    );

    if (i + BATCH_SIZE < missing.length) {
      await sleep(API_DELAY_MS);
    }
  }

  return { found: missing.length, processed };
}

// ─── Recipe Backfill ────────────────────────────────────

/**
 * Translate recipe content (name, tips, steps, ingredient notes) from es → en.
 */
async function translateRecipeToEnglish(
  recipeData: NonNullable<Awaited<ReturnType<typeof db.fetchRecipeForBackfill>>>,
  apiKey: string,
): Promise<{
  name: string;
  tipsAndTricks: string;
  steps: Array<{ id: string; instruction: string; section: string; tip: string }>;
  ingredientNotes: Array<{ id: string; notes: string; tip: string; section: string }>;
}> {
  const input = {
    recipeName: recipeData.recipe.name,
    tipsAndTricks: recipeData.recipe.tipsAndTricks,
    steps: recipeData.steps.map((s) => ({
      id: s.id,
      instruction: s.instruction,
      section: s.section,
      tip: s.tip,
    })),
    ingredientNotes: recipeData.ingredientNotes.map((ri) => ({
      id: ri.id,
      notes: ri.notes,
      tip: ri.tip,
      section: ri.section,
    })),
  };

  const schema = {
    type: 'object',
    properties: {
      recipeName: { type: 'string' },
      tipsAndTricks: { type: 'string' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            instruction: { type: 'string' },
            section: { type: 'string' },
            tip: { type: 'string' },
          },
          required: ['id', 'instruction', 'section', 'tip'],
          additionalProperties: false,
        },
      },
      ingredientNotes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            notes: { type: 'string' },
            tip: { type: 'string' },
            section: { type: 'string' },
          },
          required: ['id', 'notes', 'tip', 'section'],
          additionalProperties: false,
        },
      },
    },
    required: ['recipeName', 'tipsAndTricks', 'steps', 'ingredientNotes'],
    additionalProperties: false,
  };

  const result = await callOpenAI(
    TRANSLATE_SYSTEM_PROMPT +
      '\n\nTranslate this recipe content from Spanish to English. Preserve all IDs exactly.',
    JSON.stringify(input, null, 2),
    schema,
    apiKey,
    8000, // Recipes with many steps/ingredients need more output tokens
  ) as {
    recipeName: string;
    tipsAndTricks: string;
    steps: Array<{ id: string; instruction: string; section: string; tip: string }>;
    ingredientNotes: Array<{ id: string; notes: string; tip: string; section: string }>;
  };

  return {
    name: result.recipeName,
    tipsAndTricks: result.tipsAndTricks,
    steps: result.steps,
    ingredientNotes: result.ingredientNotes,
  };
}

export async function backfillRecipes(
  supabase: SupabaseClient,
  apiKey: string,
  targetLocale: TargetLocale,
  logger: Logger,
  limit?: number,
  dryRun = false,
): Promise<{ found: number; processed: number }> {
  // Find recipes missing the target locale
  const missing = await db.fetchEntitiesMissingLocale(
    supabase,
    'recipe_translations',
    'recipe_id',
    ['name', 'tips_and_tricks'],
    'es',
    targetLocale,
    limit,
  );

  logger.info(`recipes: ${missing.length} recipes missing ${targetLocale} translations`);

  if (dryRun || missing.length === 0) {
    return { found: missing.length, processed: 0 };
  }

  let processed = 0;

  for (const row of missing) {
    const recipeId = row.recipe_id;
    const recipeName = row.name || '(unnamed)';
    logger.info(`  Processing recipe: ${recipeName} (${recipeId})`);

    const recipeData = await db.fetchRecipeForBackfill(supabase, recipeId, 'es');
    if (!recipeData) {
      logger.warn(`  Skipping recipe ${recipeId} — no es translation found`);
      continue;
    }

    if (targetLocale === 'en') {
      // Translate es → en
      const translated = await translateRecipeToEnglish(recipeData, apiKey);

      // Upsert recipe translation
      await db.upsertEntityTranslations(supabase, 'recipe_translations', 'recipe_id', [{
        recipe_id: recipeId,
        locale: 'en',
        name: translated.name,
        tips_and_tricks: translated.tipsAndTricks,
      }]);

      // Upsert step translations
      if (translated.steps.length > 0) {
        await db.upsertEntityTranslations(
          supabase,
          'recipe_step_translations',
          'recipe_step_id',
          translated.steps.map((s) => ({
            recipe_step_id: s.id,
            locale: 'en',
            instruction: s.instruction,
            recipe_section: s.section,
            tip: s.tip,
          })),
        );
      }

      // Upsert recipe ingredient translations
      if (translated.ingredientNotes.length > 0) {
        await db.upsertEntityTranslations(
          supabase,
          'recipe_ingredient_translations',
          'recipe_ingredient_id',
          translated.ingredientNotes.map((ri) => ({
            recipe_ingredient_id: ri.id,
            locale: 'en',
            notes: ri.notes,
            tip: ri.tip,
            recipe_section: ri.section,
          })),
        );
      }
    } else {
      // Adapt es → es-ES using the spain-adapter
      const adapted = await adaptToSpainSpanish(
        {
          recipeName: recipeData.recipe.name,
          tipsAndTricks: recipeData.recipe.tipsAndTricks,
          steps: recipeData.steps.map((s) => ({
            order: s.order,
            instruction: s.instruction,
            section: s.section,
            tip: s.tip,
          })),
          ingredientNotes: recipeData.ingredientNotes.map((ri) => ({
            displayOrder: ri.displayOrder,
            notes: ri.notes,
            tip: ri.tip,
            section: ri.section,
          })),
        },
        apiKey,
        logger,
      );

      // Upsert recipe translation
      await db.upsertEntityTranslations(supabase, 'recipe_translations', 'recipe_id', [{
        recipe_id: recipeId,
        locale: 'es-ES',
        name: adapted.recipeName || recipeData.recipe.name,
        tips_and_tricks: adapted.tipsAndTricks || recipeData.recipe.tipsAndTricks,
      }]);

      // Upsert step translations — map by order back to step IDs
      if (adapted.steps && adapted.steps.length > 0) {
        const orderToId = new Map(recipeData.steps.map((s) => [s.order, s.id]));
        const stepRows = adapted.steps
          .filter((s) => orderToId.has(s.order))
          .map((s) => ({
            recipe_step_id: orderToId.get(s.order)!,
            locale: 'es-ES',
            instruction: s.instruction,
            recipe_section: s.section,
            tip: s.tip,
          }));
        if (stepRows.length > 0) {
          await db.upsertEntityTranslations(
            supabase,
            'recipe_step_translations',
            'recipe_step_id',
            stepRows,
          );
        }
      }

      // Upsert recipe ingredient translations — map by displayOrder back to IDs
      if (adapted.ingredientNotes && adapted.ingredientNotes.length > 0) {
        const orderToId = new Map(recipeData.ingredientNotes.map((ri) => [ri.displayOrder, ri.id]));
        const riRows = adapted.ingredientNotes
          .filter((ri) => orderToId.has(ri.displayOrder))
          .map((ri) => ({
            recipe_ingredient_id: orderToId.get(ri.displayOrder)!,
            locale: 'es-ES',
            notes: ri.notes,
            tip: ri.tip,
            recipe_section: ri.section,
          }));
        if (riRows.length > 0) {
          await db.upsertEntityTranslations(
            supabase,
            'recipe_ingredient_translations',
            'recipe_ingredient_id',
            riRows,
          );
        }
      }
    }

    processed++;
    logger.success(`  Backfilled ${targetLocale} for recipe: ${recipeName}`);
    await sleep(API_DELAY_MS);
  }

  return { found: missing.length, processed };
}
