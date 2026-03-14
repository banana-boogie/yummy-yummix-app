#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * Scan Notion Markdown Exports for Entity Names
 *
 * Extracts ingredient names, useful item names, and tags from Notion recipe
 * markdown files WITHOUT hitting any AI API. Outputs a JSON report of all
 * unique entities found across the export, useful for pre-seeding the DB
 * before running the full import.
 *
 * Usage:
 *   deno run --allow-read --allow-write data-pipeline/cli/scan-entities.ts \
 *     --dir ./path/to/RECIPES
 *
 * Output: data-pipeline/scan-report.json
 */

// ─── Helpers ─────────────────────────────────────────────

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

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
  // "cilantro, y un poco más para decorar" → "cilantro"
  // "pepino, pelado y cortado en trozos" → "pepino"
  text = text.replace(/,\s+.*$/, '');

  return text.trim();
}

// ─── Extraction ──────────────────────────────────────────

interface ScanResult {
  ingredients: Map<string, number>; // name → count of recipes containing it
  usefulItems: Map<string, number>;
  tags: Map<string, number>;
  recipeCount: number;
  stubCount: number;
}

function hasRecipeContent(content: string): boolean {
  const lines = content.split('\n');
  let inIngredientes = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '### Ingredientes') { inIngredientes = true; continue; }
    if (inIngredientes) {
      if (trimmed.startsWith('#')) break;
      if (trimmed.startsWith('-') && trimmed.length > 2) return true;
    }
  }
  return false;
}

function extractEntities(content: string): {
  ingredients: string[];
  usefulItems: string[];
  tags: string[];
} {
  const lines = content.split('\n');
  const ingredients: string[] = [];
  const usefulItems: string[] = [];
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
      break; // Only first Tags line
    }
  }

  // Extract ingredients and useful items by section
  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers
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

    // Extract based on current section
    if (section === 'ingredientes' && trimmed.startsWith('-') && trimmed.length > 2) {
      const name = extractIngredientName(trimmed);
      if (name) ingredients.push(name.toLowerCase());
    }

    if (section === 'utensilios' && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-') && !trimmed.startsWith('<')) {
      // Useful items are comma-separated on a single line
      for (const item of trimmed.split(',').map((s) => s.trim()).filter(Boolean)) {
        // Skip hashtag entries and HTML tags that leaked into this section
        if (item.length > 1 && !item.startsWith('#') && !item.startsWith('<')) {
          usefulItems.push(item.toLowerCase());
        }
      }
    }
    // Also handle list format for useful items
    if (section === 'utensilios' && trimmed.startsWith('-') && trimmed.length > 2) {
      const item = trimmed.replace(/^-\s*/, '').trim();
      if (item && !item.startsWith('**') && !item.startsWith('#')) usefulItems.push(item.toLowerCase());
    }
  }

  return { ingredients, usefulItems, tags };
}

// ─── Main ────────────────────────────────────────────────

const dataDir = parseFlag(Deno.args, '--dir');
if (!dataDir) {
  console.error('Usage: deno run ... --dir ./path/to/RECIPES');
  Deno.exit(1);
}

const ingredients = new Map<string, number>();
const usefulItems = new Map<string, number>();
const tags = new Map<string, number>();
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
    ingredients.set(name, (ingredients.get(name) || 0) + 1);
  }
  for (const name of new Set(entities.usefulItems)) {
    usefulItems.set(name, (usefulItems.get(name) || 0) + 1);
  }
  for (const name of new Set(entities.tags)) {
    tags.set(name, (tags.get(name) || 0) + 1);
  }
}

// Sort by frequency (most common first)
const sortByCount = (map: Map<string, number>) =>
  [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

const report = {
  summary: {
    totalFiles: recipeCount + stubCount,
    recipesWithContent: recipeCount,
    stubs: stubCount,
    uniqueIngredients: ingredients.size,
    uniqueUsefulItems: usefulItems.size,
    uniqueTags: tags.size,
  },
  ingredients: sortByCount(ingredients),
  usefulItems: sortByCount(usefulItems),
  tags: sortByCount(tags),
};

const outPath = new URL('../scan-report.json', import.meta.url).pathname;
Deno.writeTextFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`\n=== Entity Scan Report ===\n`);
console.log(`Recipes with content: ${recipeCount}`);
console.log(`Stubs (no content): ${stubCount}`);
console.log(`Unique ingredients: ${ingredients.size}`);
console.log(`Unique useful items: ${usefulItems.size}`);
console.log(`Unique tags: ${tags.size}`);
console.log(`\nTop 20 ingredients:`);
for (const { name, count } of sortByCount(ingredients).slice(0, 20)) {
  console.log(`  ${count.toString().padStart(3)}x  ${name}`);
}
console.log(`\nAll useful items:`);
for (const { name, count } of sortByCount(usefulItems)) {
  console.log(`  ${count.toString().padStart(3)}x  ${name}`);
}
console.log(`\nAll tags:`);
for (const { name, count } of sortByCount(tags)) {
  console.log(`  ${count.toString().padStart(3)}x  ${name}`);
}
console.log(`\nFull report: ${outPath}`);
