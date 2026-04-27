/**
 * Notion Tag Map
 *
 * Maps Notion export tag strings to canonical DB tag names.
 * The importer uses this to resolve tags by exact lookup instead of
 * relying on the LLM, which can return inconsistent tag names.
 *
 * Format: { "Notion tag string" -> { en, es } canonical DB tag names }
 * If the DB tag doesn't exist in the seeded taxonomy, the importer skips it.
 */

/** Map from Notion tag string → { en, es } canonical translations for DB lookup. */
export const NOTION_TAG_MAP: Record<string, { en: string; es: string }> = {
  'Postre': { en: 'dessert', es: 'Postre' },
  'Bebida': { en: 'beverage', es: 'Bebida' },
  'Vegetarian': { en: 'vegetarian', es: 'Vegetariana' },
  'Desayuno': { en: 'breakfast', es: 'Desayuno' },
  'Mexican': { en: 'mexican', es: 'Mexicana' },
  'Indian': { en: 'indian', es: 'India' },
  'Botana': { en: 'snack', es: 'Botana' },
  'Todo en 1': { en: 'one_pot', es: 'Una Sola Olla' },
  'Sugar Free': { en: 'low_sugar', es: 'Bajo en Azúcar' },
};

/**
 * Resolve a Notion tag string to the { en, es } pair for DB lookup.
 * Returns undefined if the tag isn't in the map (shouldn't happen for known tags).
 */
export function resolveNotionTag(
  notionTag: string,
): { en: string; es: string } | undefined {
  return NOTION_TAG_MAP[notionTag];
}
