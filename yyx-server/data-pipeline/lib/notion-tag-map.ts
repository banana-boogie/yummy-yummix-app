/**
 * Notion Tag Map
 *
 * Maps Notion export tag strings to DB tag names (EN).
 * The importer uses this to resolve tags by exact lookup instead of
 * relying on the LLM, which can return inconsistent tag names.
 *
 * Format: { "Notion tag string" → "DB tag name_en" }
 * If the DB tag doesn't exist yet, it will be created with both EN and ES translations.
 */

/** Map from Notion tag string → { en, es } translations for DB lookup/creation */
export const NOTION_TAG_MAP: Record<string, { en: string; es: string }> = {
  // ─── Already matched (just normalize the lookup) ──────
  'Postre': { en: 'dessert', es: 'postre' },
  'Sopa': { en: 'soup', es: 'sopa' },
  'Pollo': { en: 'chicken', es: 'pollo' },
  'Bebida': { en: 'drink', es: 'bebida' },
  'Seafood': { en: 'seafood', es: 'mariscos' },
  'Res': { en: 'beef', es: 'res' },
  'Pasta': { en: 'pasta', es: 'pasta' },
  'Vegetarian': { en: 'vegetarian', es: 'vegetariano' },
  'Aperitivo': { en: 'appetizer', es: 'aperitivo' },
  'Cerdo': { en: 'pork', es: 'cerdo' },
  'Panadería': { en: 'bakery', es: 'panadería' },
  'Healthy': { en: 'healthy', es: 'saludable' },
  'Desayuno': { en: 'breakfast', es: 'desayuno' },
  'Mexican': { en: 'mexican', es: 'mexicano' },
  'Halloween': { en: 'halloween', es: 'halloween' },
  'Indian': { en: 'indian', es: 'indio' },
  'Básicos de la cocina': { en: 'kitchenbasics', es: 'básicosdelacocina' },

  // ─── Missing — need to be created or mapped ───────────
  'Plato fuerte': { en: 'main course', es: 'plato fuerte' },
  'Guarnicion': { en: 'sides', es: 'acompañamiento' },
  'Salsas': { en: 'sauces', es: 'salsas' },
  'Dip/Dressing': { en: 'dip', es: 'dip' },
  'Botana': { en: 'snack', es: 'merienda' },
  'International': { en: 'international', es: 'internacional' },
  'Todo en 1': { en: 'one pot', es: 'todo en 1' },
  'FAV': { en: 'favorite', es: 'favorito' },
  'Lamb': { en: 'lamb', es: 'cordero' },
  'Sugar Free': { en: 'sugarfree', es: 'sinazúcar' },
  'Candy': { en: 'candy', es: 'dulces' },
  'Baby friendly': { en: 'babyfriendly', es: 'aptoparabebe' },
  'Sin gluten': { en: 'glutenfree', es: 'singluten' },
  'Spices': { en: 'spices', es: 'especias' },
};

/**
 * Resolve a Notion tag string to the { en, es } pair for DB lookup.
 * Returns undefined if the tag isn't in the map (shouldn't happen for known tags).
 */
export function resolveNotionTag(notionTag: string): { en: string; es: string } | undefined {
  return NOTION_TAG_MAP[notionTag];
}
