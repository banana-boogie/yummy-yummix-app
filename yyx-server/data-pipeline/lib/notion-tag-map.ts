/**
 * Notion Tag Map
 *
 * Maps Notion export tag strings to canonical recipe-tag slugs.
 * The importer uses this to resolve tags by slug instead of relying on
 * the LLM, whose output for tag names is inconsistent.
 *
 * Format: { "Notion tag string" -> { slug, en, es } }
 *   - slug: canonical lower_snake_case slug from the tag taxonomy seed
 *   - en/es: display names matching the seeded translations (used for
 *           logging and as a fallback for legacy code that matches by name)
 *
 * If a Notion tag has no canonical home it must be added to INTENTIONAL_DROPS
 * below. The regression test in lib/__tests__/notion-tag-map.test.ts asserts
 * that every tag observed in scan-report.json is either mapped here or
 * explicitly listed as a drop.
 */

export interface NotionTagMapping {
  slug: string;
  en: string;
  es: string;
}

export const NOTION_TAG_MAP: Record<string, NotionTagMapping> = {
  // meal_type
  'Postre': { slug: 'dessert', en: 'Dessert', es: 'Postre' },
  'Bebida': { slug: 'beverage', en: 'Beverage', es: 'Bebida' },
  'Desayuno': { slug: 'breakfast', en: 'Breakfast', es: 'Desayuno' },
  'Botana': { slug: 'snack', en: 'Snack', es: 'Botana' },

  // cuisine
  'Mexican': { slug: 'mexican', en: 'Mexican', es: 'Mexicana' },
  'Indian': { slug: 'indian', en: 'Indian', es: 'India' },

  // diet
  'Vegetarian': { slug: 'vegetarian', en: 'Vegetarian', es: 'Vegetariana' },
  'Sugar Free': { slug: 'low_sugar', en: 'Low Sugar', es: 'Bajo en Azúcar' },
  'Sin gluten': { slug: 'gluten_free', en: 'Gluten Free', es: 'Sin Gluten' },
  'Healthy': { slug: 'healthy', en: 'Healthy', es: 'Saludable' },

  // dish_type
  'Sopa': { slug: 'soup', en: 'Soup', es: 'Sopa' },
  'Salsas': { slug: 'sauce', en: 'Sauce', es: 'Salsa' },
  'Dip/Dressing': { slug: 'dip_dressing', en: 'Dip & Dressing', es: 'Dip y Aderezo' },
  'Aperitivo': { slug: 'appetizer', en: 'Appetizer', es: 'Aperitivo' },
  'Plato fuerte': { slug: 'main_dish', en: 'Main Dish', es: 'Plato Fuerte' },
  'Guarnicion': { slug: 'side_dish', en: 'Side Dish', es: 'Guarnición' },
  'Panadería': { slug: 'bakery', en: 'Bakery', es: 'Panadería' },
  'Pasta': { slug: 'pasta', en: 'Pasta', es: 'Pasta' },
  'Candy': { slug: 'candy', en: 'Candy', es: 'Dulces' },

  // primary_ingredient
  'Pollo': { slug: 'chicken', en: 'Chicken', es: 'Pollo' },
  'Res': { slug: 'beef', en: 'Beef', es: 'Res' },
  'Cerdo': { slug: 'pork', en: 'Pork', es: 'Cerdo' },
  'Seafood': { slug: 'seafood', en: 'Seafood', es: 'Mariscos' },
  'Lamb': { slug: 'lamb', en: 'Lamb', es: 'Cordero' },

  // occasion
  'Halloween': { slug: 'holiday_halloween', en: 'Halloween', es: 'Halloween / Día de Brujas' },
  'Baby friendly': { slug: 'baby_friendly', en: 'Baby Friendly', es: 'Apto para Bebés' },

  // practical
  'Todo en 1': { slug: 'one_pot', en: 'One Pot', es: 'Una Sola Olla' },
  'Básicos de la cocina': { slug: 'pantry_staple', en: 'Pantry Staple', es: 'Básicos de Cocina' },
  'Spices': { slug: 'pantry_staple', en: 'Pantry Staple', es: 'Básicos de Cocina' },
};

/**
 * Notion tags that intentionally have no canonical mapping. These are
 * dropped at import time. The regression test enforces that every tag in
 * scan-report.json is in NOTION_TAG_MAP or in this list.
 */
export const INTENTIONAL_DROPS: readonly string[] = [
  'FAV', // user-personalization concern, not taxonomy
  'International', // vague catch-all; cuisine handles specifics
];

/**
 * Resolve a Notion tag string to its canonical mapping.
 * Returns undefined for unknown tags and intentional drops alike — callers
 * should consult INTENTIONAL_DROPS if they need to distinguish.
 */
export function resolveNotionTag(notionTag: string): NotionTagMapping | undefined {
  return NOTION_TAG_MAP[notionTag];
}
