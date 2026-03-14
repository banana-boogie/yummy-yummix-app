/**
 * Entity Matcher
 *
 * Matches parsed recipe entities (ingredients, tags, useful items)
 * against existing database records. Ported from yyx-app/utils/ingredients/ingredientMatcher.ts
 */

// Ingredient name fields interface
export interface NameFields {
  nameEn: string;
  nameEs: string;
  pluralNameEn?: string;
  pluralNameEs?: string;
}

/**
 * DB row types — flattened from translation tables by db.ts fetch functions.
 * Fields like name_en/name_es don't exist as columns on the base tables;
 * they come from *_translations tables joined and flattened at read time.
 */
export interface DbIngredient {
  id: string;
  name_en: string;
  name_es: string;
  plural_name_en: string;
  plural_name_es: string;
  image_url: string;
  nutritional_facts: Record<string, unknown> | null;
}

export interface DbKitchenTool {
  id: string;
  name_en: string;
  name_es: string;
  image_url: string;
}

export interface DbRecipeTag {
  id: string;
  name_en: string;
  name_es: string;
  categories: string[];
}

export interface DbMeasurementUnit {
  id: string;
  type: string;
  system: string;
  name_en: string;
  name_es: string;
  symbol_en: string;
  symbol_es: string;
}

// Distinct ingredients that should NOT match their base form
const DISTINCT_INGREDIENTS = [
  { base: 'sugar', distinct: ['brown sugar', 'powdered sugar', 'granulated sugar'] },
  { base: 'flour', distinct: ['all-purpose flour', 'bread flour', 'cake flour'] },
];

const PREP_PREFIXES = [
  'chopped ',
  'diced ',
  'sliced ',
  'minced ',
  'grated ',
  'large ',
  'freshly squeezed ',
  'cloves ',
  'fresh ',
  'extra virgin ',
];

function normalize(name: string | undefined): string {
  if (!name) return '';
  return name.toLowerCase().trim();
}

function stripPrep(name: string): string {
  let result = name;
  for (const prefix of PREP_PREFIXES) {
    result = result.replace(prefix, '');
  }
  return result;
}

function isVariation(name1: string, name2: string): boolean {
  const n1 = normalize(name1);
  const n2 = normalize(name2);
  if (!n1 && !n2) return false;
  if (n1 === n2) return true;

  // Check distinct ingredients
  for (const { base, distinct } of DISTINCT_INGREDIENTS) {
    if ((n1 === base && distinct.includes(n2)) || (n2 === base && distinct.includes(n1))) {
      return false;
    }
  }

  // Try matching after stripping prep prefixes
  return stripPrep(n1) === stripPrep(n2);
}

function editDistance(s1: string, s2: string): number {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  const costs: number[] = [];
  for (let i = 0; i <= a.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= b.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (a.charAt(i - 1) !== b.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[b.length] = lastValue;
  }
  return costs[b.length];
}

function similarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  return (longer.length - editDistance(longer, shorter)) / longer.length;
}

// High threshold = only exact matches + minor typos. Prevents mis-matching
// similar but distinct ingredients (e.g., "tomillo"/thyme → "romero"/rosemary).
const SIMILARITY_THRESHOLD = 0.95;

/** Match a parsed ingredient against the database ingredient list */
export function matchIngredient(
  search: NameFields,
  dbIngredients: DbIngredient[],
): DbIngredient | null {
  // Exact match first
  const exact = dbIngredients.find((db) =>
    isVariation(search.nameEn, db.name_en) ||
    isVariation(search.nameEn, db.plural_name_en) ||
    isVariation(search.nameEs, db.name_es) ||
    isVariation(search.nameEs, db.plural_name_es)
  );
  if (exact) return exact;

  // Fuzzy match
  const fuzzy = dbIngredients.find((db) =>
    similarity(normalize(search.nameEn), normalize(db.name_en)) >= SIMILARITY_THRESHOLD ||
    similarity(normalize(search.nameEs), normalize(db.name_es)) >= SIMILARITY_THRESHOLD
  );
  return fuzzy || null;
}

/** Match a tag name against existing tags (EN or ES, with or without #) */
export function matchTag(tagName: string, dbTags: DbRecipeTag[]): DbRecipeTag | null {
  const normalized = tagName.startsWith('#') ? tagName.substring(1) : tagName;
  return dbTags.find(
    (tag) =>
      tag.name_en.toLowerCase() === normalized.toLowerCase() ||
      tag.name_es.toLowerCase() === normalized.toLowerCase(),
  ) || null;
}

/** Match a kitchen tool by name (EN or ES).
 * Uses exact match first, then substring match to handle cases like
 * "Varoma" matching "Varoma Thermomix®" or "Cestillo" matching "Cestillo Thermomix®".
 */
export function matchKitchenTool(
  search: { nameEn: string; nameEs: string },
  dbItems: DbKitchenTool[],
): DbKitchenTool | null {
  const searchEn = search.nameEn.toLowerCase().trim();
  const searchEs = search.nameEs.toLowerCase().trim();

  // Exact match first
  const exact = dbItems.find(
    (item) =>
      item.name_en.toLowerCase().trim() === searchEn ||
      item.name_es.toLowerCase().trim() === searchEs,
  );
  if (exact) return exact;

  // Substring match: search term is contained in DB name, or vice versa
  // Requires at least 3 chars to avoid false positives
  if (searchEn.length >= 3 || searchEs.length >= 3) {
    const substr = dbItems.find((item) => {
      const dbEn = item.name_en.toLowerCase().trim();
      const dbEs = item.name_es.toLowerCase().trim();
      return (searchEn.length >= 3 && (dbEn.includes(searchEn) || searchEn.includes(dbEn))) ||
        (searchEs.length >= 3 && (dbEs.includes(searchEs) || searchEs.includes(dbEs)));
    });
    if (substr) return substr;
  }

  return null;
}

/** Match a measurement unit by ID */
export function matchMeasurementUnit(
  unitId: string,
  dbUnits: DbMeasurementUnit[],
): DbMeasurementUnit | null {
  return dbUnits.find((u) => u.id.toLowerCase() === unitId.toLowerCase()) || null;
}
