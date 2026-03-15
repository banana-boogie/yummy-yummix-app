#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env
/**
 * Scan Notion Markdown Exports for Entity Names
 *
 * Extracts ingredient names, kitchen tool names, and tags from Notion recipe
 * markdown files WITHOUT hitting any AI API. Cross-references against the
 * database to show only MISSING entities that need to be pre-seeded.
 *
 * Usage:
 *   deno task pipeline:scan --local --dir ./path/to/RECIPES
 *
 * Output: data-pipeline/scan-report.json
 */

import { createPipelineConfig, hasFlag, parseEnvironment, parseFlag } from '../lib/config.ts';
import {
  type DbIngredient,
  type DbRecipeTag,
  type DbKitchenTool,
  editDistance,
  similarity,
} from '../lib/entity-matcher.ts';
import { hasRecipeContent } from '../lib/import-helpers.ts';
import { Logger } from '../lib/logger.ts';
import * as db from '../lib/db.ts';

// ─── Helpers ─────────────────────────────────────────────

/**
 * Strip quantity, unit, and prep notes from a Spanish ingredient line.
 * "250 g de aceite de oliva" → "aceite de oliva"
 * "2 dientes de ajo" → "dientes de ajo"
 * "1 cucharadita de sal gruesa" → "sal gruesa"
 * "½ cdita de salsa Inglesa" → "salsa Inglesa"
 * "tostadas" → "tostadas"
 */
function extractIngredientName(line: string): string {
  let text = line.replace(/^-\s*/, '').trim();

  // Remove quantity prefix: numbers, fractions (½ ¼ ¾), decimals
  text = text.replace(/^[\d.,½¼¾⅓⅔⅛]+\s*/, '');

  // Remove unit prefix (common Spanish units)
  const unitPrefixes = [
    'kg', 'g', 'ml', 'l', 'lb', 'oz',
    'cucharadas?', 'cucharaditas?', 'cdas?\\.?', 'cditas?\\.?',
    'tazas?', 'pizcas?', 'rebanadas?', 'ramitas?', 'dientes?',
    'hojas?', 'piezas?', 'unidades?', 'latas?', 'sobres?',
  ];
  const unitRegex = new RegExp(`^(${unitPrefixes.join('|')})\\s+(de\\s+)?`, 'i');
  text = text.replace(unitRegex, '');

  // Remove leading "de " if still present
  text = text.replace(/^de\s+/i, '');

  // Remove trailing prep notes after comma
  text = text.replace(/,\s+.*$/, '');

  return text.trim();
}

// ─── Fuzzy matching ──────────────────────────────────────

function normalize(name: string): string {
  return name.toLowerCase().trim();
}

const SIMILARITY_THRESHOLD = 0.95;

/** Check if a Spanish ingredient name matches any DB ingredient */
function findIngredientMatch(nameEs: string, dbIngredients: DbIngredient[]): DbIngredient | null {
  const n = normalize(nameEs);
  // Exact match on name_es or plural_name_es
  const exact = dbIngredients.find(
    (db) => normalize(db.name_es) === n || normalize(db.plural_name_es) === n,
  );
  if (exact) return exact;
  // Fuzzy match
  return dbIngredients.find(
    (db) => similarity(n, normalize(db.name_es)) >= SIMILARITY_THRESHOLD,
  ) || null;
}

/** Check if a tag name matches any DB tag */
function findTagMatch(tagName: string, dbTags: DbRecipeTag[]): DbRecipeTag | null {
  const n = normalize(tagName);
  return dbTags.find(
    (tag) => normalize(tag.name_en) === n || normalize(tag.name_es) === n,
  ) || null;
}

/** Check if a kitchen tool name matches any DB item */
function findKitchenToolMatch(nameEs: string, dbItems: DbKitchenTool[]): DbKitchenTool | null {
  const n = normalize(nameEs);
  const exact = dbItems.find(
    (item) => normalize(item.name_en) === n || normalize(item.name_es) === n,
  );
  if (exact) return exact;
  return dbItems.find(
    (item) => similarity(n, normalize(item.name_es)) >= SIMILARITY_THRESHOLD ||
      similarity(n, normalize(item.name_en)) >= SIMILARITY_THRESHOLD,
  ) || null;
}

// ─── Extraction ──────────────────────────────────────────

function extractEntities(content: string): {
  ingredients: string[];
  kitchenTools: string[];
  tags: string[];
} {
  const lines = content.split('\n');
  const ingredients: string[] = [];
  const kitchenTools: string[] = [];
  const tags: string[] = [];

  let section: 'none' | 'ingredientes' | 'procedimiento' | 'tips' | 'utensilios' = 'none';

  // Extract tags from metadata line
  for (const line of lines) {
    const tagMatch = line.match(/^\s*Tags?:\s*(.+)$/i);
    if (tagMatch) {
      const tagLine = tagMatch[1].trim();
      if (tagLine) {
        for (const t of tagLine.split(/[,\-]/).map((s) => s.trim()).filter(Boolean)) {
          tags.push(t);
        }
      }
      break;
    }
  }

  // Extract ingredients and kitchen tools by section
  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '### Ingredientes' || trimmed === '### Ingredients (metric)') {
      section = 'ingredientes';
      continue;
    }
    if (trimmed.startsWith('### Procedimiento') || trimmed.startsWith('### Instructions')) {
      section = 'procedimiento';
      continue;
    }
    if (trimmed.startsWith('### Tips')) {
      section = 'tips';
      continue;
    }
    if (trimmed.startsWith('### Utensilios') || trimmed.startsWith('### Useful tools')) {
      section = 'utensilios';
      continue;
    }
    if (trimmed.startsWith('#') || trimmed.startsWith('---') || trimmed.startsWith('<aside')) {
      if (section === 'utensilios' && trimmed.startsWith('- **Tags')) {
        section = 'none';
        continue;
      }
      if (trimmed.startsWith('#') || trimmed.startsWith('---')) {
        section = 'none';
        continue;
      }
    }

    if (section === 'ingredientes' && trimmed.startsWith('-') && trimmed.length > 2) {
      const name = extractIngredientName(trimmed);
      if (name) ingredients.push(name.toLowerCase());
    }

    if (section === 'utensilios' && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-') && !trimmed.startsWith('<')) {
      for (const item of trimmed.split(',').map((s) => s.trim()).filter(Boolean)) {
        if (item.length > 1 && !item.startsWith('#') && !item.startsWith('<')) {
          kitchenTools.push(item.toLowerCase());
        }
      }
    }
    if (section === 'utensilios' && trimmed.startsWith('-') && trimmed.length > 2) {
      const item = trimmed.replace(/^-\s*/, '').trim();
      if (item && !item.startsWith('**') && !item.startsWith('#')) kitchenTools.push(item.toLowerCase());
    }
  }

  return { ingredients, kitchenTools, tags };
}

// ─── Main ────────────────────────────────────────────────

const logger = new Logger('scan');
const env = parseEnvironment(Deno.args);
const config = createPipelineConfig(env);
const dataDir = parseFlag(Deno.args, '--dir');

if (!dataDir) {
  logger.error('Usage: deno task pipeline:scan --local --dir ./path/to/RECIPES');
  Deno.exit(1);
}

logger.info('Loading reference data from database...');
const [dbIngredients, dbTags, dbKitchenTools] = await Promise.all([
  db.fetchAllIngredients(config.supabase),
  db.fetchAllTags(config.supabase),
  db.fetchAllKitchenTools(config.supabase),
]);
logger.info(
  `Loaded: ${dbIngredients.length} ingredients, ${dbTags.length} tags, ${dbKitchenTools.length} kitchen tools`,
);

// Scan files
const allIngredients = new Map<string, number>();
const allKitchenTools = new Map<string, number>();
const allTags = new Map<string, number>();
let recipeCount = 0;
let stubCount = 0;

for (const entry of Deno.readDirSync(dataDir)) {
  if (!entry.isFile || !entry.name.endsWith('.md')) continue;
  const content = Deno.readTextFileSync(`${dataDir}/${entry.name}`);

  if (!hasRecipeContent(content)) {
    stubCount++;
    continue;
  }

  recipeCount++;
  const entities = extractEntities(content);

  for (const name of new Set(entities.ingredients)) {
    allIngredients.set(name, (allIngredients.get(name) || 0) + 1);
  }
  for (const name of new Set(entities.kitchenTools)) {
    allKitchenTools.set(name, (allKitchenTools.get(name) || 0) + 1);
  }
  for (const name of new Set(entities.tags)) {
    allTags.set(name, (allTags.get(name) || 0) + 1);
  }
}

// Cross-reference against DB
const missingIngredients: Array<{ name: string; count: number }> = [];
const matchedIngredients: Array<{ name: string; count: number; matchedTo: string }> = [];
for (const [name, count] of allIngredients) {
  const match = findIngredientMatch(name, dbIngredients);
  if (match) {
    matchedIngredients.push({ name, count, matchedTo: `${match.name_es} / ${match.name_en}` });
  } else {
    missingIngredients.push({ name, count });
  }
}
missingIngredients.sort((a, b) => b.count - a.count);

const missingTags: Array<{ name: string; count: number }> = [];
const matchedTags: Array<{ name: string; count: number; matchedTo: string }> = [];
for (const [name, count] of allTags) {
  const match = findTagMatch(name, dbTags);
  if (match) {
    matchedTags.push({ name, count, matchedTo: `${match.name_es} / ${match.name_en}` });
  } else {
    missingTags.push({ name, count });
  }
}
missingTags.sort((a, b) => b.count - a.count);

const missingKitchenTools: Array<{ name: string; count: number }> = [];
const matchedKitchenTools: Array<{ name: string; count: number; matchedTo: string }> = [];
for (const [name, count] of allKitchenTools) {
  const match = findKitchenToolMatch(name, dbKitchenTools);
  if (match) {
    matchedKitchenTools.push({ name, count, matchedTo: `${match.name_es} / ${match.name_en}` });
  } else {
    missingKitchenTools.push({ name, count });
  }
}
missingKitchenTools.sort((a, b) => b.count - a.count);

// Write report
const report = {
  summary: {
    totalFiles: recipeCount + stubCount,
    recipesWithContent: recipeCount,
    stubs: stubCount,
    ingredients: {
      total: allIngredients.size,
      matched: matchedIngredients.length,
      missing: missingIngredients.length,
    },
    kitchenTools: {
      total: allKitchenTools.size,
      matched: matchedKitchenTools.length,
      missing: missingKitchenTools.length,
    },
    tags: {
      total: allTags.size,
      matched: matchedTags.length,
      missing: missingTags.length,
    },
  },
  missingIngredients,
  missingKitchenTools,
  missingTags,
  matchedIngredients,
  matchedKitchenTools,
  matchedTags,
};

const outPath = new URL('../scan-report.json', import.meta.url).pathname;
Deno.writeTextFileSync(outPath, JSON.stringify(report, null, 2));

// Console output
logger.section('Entity Scan Report');
logger.info(`Recipes with content: ${recipeCount} (${stubCount} stubs filtered)`);

logger.info(
  `INGREDIENTS: ${allIngredients.size} unique -> ${matchedIngredients.length} matched, ${missingIngredients.length} MISSING`,
);
if (missingIngredients.length > 0) {
  logger.info('Missing ingredients (need to create):');
  for (const { name, count } of missingIngredients) {
    logger.info(`  ${count.toString().padStart(3)}x  ${name}`);
  }
}

logger.info(
  `KITCHEN TOOLS: ${allKitchenTools.size} unique -> ${matchedKitchenTools.length} matched, ${missingKitchenTools.length} MISSING`,
);
if (missingKitchenTools.length > 0) {
  logger.info('Missing kitchen tools (need to create):');
  for (const { name, count } of missingKitchenTools) {
    logger.info(`  ${count.toString().padStart(3)}x  ${name}`);
  }
}

logger.info(
  `TAGS: ${allTags.size} unique -> ${matchedTags.length} matched, ${missingTags.length} MISSING`,
);
if (missingTags.length > 0) {
  logger.info('Missing tags (need to create):');
  for (const { name, count } of missingTags) {
    logger.info(`  ${count.toString().padStart(3)}x  ${name}`);
  }
}

logger.info(`Full report: ${outPath}`);
