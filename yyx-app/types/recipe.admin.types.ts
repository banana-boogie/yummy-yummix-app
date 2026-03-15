import { Recipe } from '@/types/recipe.types';
import { ThermomixSpeed, ThermomixTemperature, ThermomixTemperatureUnit } from '@/types/thermomix.types';

export interface NutritionalFacts {
  calories: number | string | undefined;
  protein: number | string | undefined;
  fat: number | string | undefined;
  carbohydrates: number | string | undefined;
}

/**
 * Base interface for all entity translations.
 * Each concrete translation extends this with its specific fields.
 */
export interface EntityTranslation {
  locale: string;
  [key: string]: string | undefined;
}

export interface AdminRecipeTranslation extends EntityTranslation {
  name: string;
  tipsAndTricks?: string;
}

export interface AdminIngredientTranslation extends EntityTranslation {
  name: string;
  pluralName?: string;
}

export interface AdminRecipeTagTranslation extends EntityTranslation {
  name: string;
}

export interface AdminKitchenToolTranslation extends EntityTranslation {
  name: string;
}

export interface AdminRecipeIngredientTranslation extends EntityTranslation {
  notes?: string;
  tip?: string;
  recipeSection?: string;
}

export interface AdminRecipeStepTranslation extends EntityTranslation {
  instruction: string;
  recipeSection?: string;
  tip?: string;
}

export interface AdminRecipeKitchenToolTranslation extends EntityTranslation {
  notes?: string;
}

export interface AdminMeasurementUnitTranslation extends EntityTranslation {
  name: string;
  namePlural?: string;
  symbol: string;
  symbolPlural?: string;
}

export interface AdminMeasurementUnit {
  id: string;
  type: 'volume' | 'weight' | 'unit';
  system: 'metric' | 'imperial' | 'universal';
  translations: AdminMeasurementUnitTranslation[];
}

export interface AdminIngredient {
  id: string;
  translations: AdminIngredientTranslation[];
  pictureUrl: string;
  nutritionalFacts?: NutritionalFacts;
}

export interface AdminKitchenTool {
  id: string;
  translations: AdminKitchenToolTranslation[];
  pictureUrl: string | any;
}

export interface AdminRecipeIngredient {
  id: string;
  ingredientId: string;
  ingredient: AdminIngredient;
  quantity: string;
  translations: AdminRecipeIngredientTranslation[];
  optional: boolean;
  displayOrder: number;
  measurementUnit: AdminMeasurementUnit;
}

export interface AdminRecipeTag {
  id: string;
  translations: AdminRecipeTagTranslation[];
  categories: string[];
}

export interface AdminRecipeSteps {
  id: string;
  order: number;
  translations: AdminRecipeStepTranslation[];
  thermomixTime?: number | null;
  thermomixSpeed?: ThermomixSpeed;
  thermomixTemperature?: ThermomixTemperature | null;
  thermomixTemperatureUnit?: ThermomixTemperatureUnit | null;
  thermomixIsBladeReversed? : boolean | null;
  ingredients?: AdminRecipeStepIngredient[];
}

export interface AdminRecipeStepIngredient {
  id: string;
  recipeId: string;
  recipeStepId: string;
  ingredientId: string;
  measurementUnitId: string;
  quantity: string;
  optional: boolean;
  displayOrder: number;
  ingredient: AdminIngredient;
  measurementUnit: AdminMeasurementUnit | undefined;
}

export interface AdminRecipeKitchenTool {
  id: string;
  recipeId: string;
  kitchenToolId: string;
  displayOrder: number;
  translations: AdminRecipeKitchenToolTranslation[];
  kitchenTool: AdminKitchenTool;
}

export interface AdminRecipe extends Omit<Recipe, 'name' | 'ingredients' | 'tags' | 'steps' | 'kitchenTools'> {
  translations: AdminRecipeTranslation[];
  ingredients: AdminRecipeIngredient[];
  tags: AdminRecipeTag[];
  steps: AdminRecipeSteps[];
  kitchenTools?: AdminRecipeKitchenTool[];
}

// ============================================================
// Locale helpers — used by services and UI to extract
// a single locale's value from translations arrays.
// ============================================================

/**
 * Pick a translation object for a given locale from a translations array.
 * Falls back within language family: es-ES → es (base language).
 */
export function pickTranslation<T extends { locale: string }>(
  translations: T[] | undefined | null,
  locale: string,
): T | undefined {
  if (!translations) return undefined;
  // Exact match first
  const exact = translations.find(t => t.locale === locale);
  if (exact) return exact;
  // Fall back to base language (e.g., es-ES → es)
  if (locale.includes('-')) {
    const base = locale.split('-')[0];
    return translations.find(t => t.locale === base);
  }
  return undefined;
}

/**
 * Get a specific field value for a locale from translations.
 */
export function getTranslatedField<T extends { locale: string }>(
  translations: T[] | undefined | null,
  locale: string,
  field: keyof T,
): string {
  const t = pickTranslation(translations, locale);
  return (t?.[field] as string) || '';
}

/**
 * Get a display name from translations, preferring es (Mexico-first) then en.
 */
export function getNameFromTranslations(
  translations: EntityTranslation[] | undefined | null,
  fallbackName = 'item',
): string {
  if (!translations || translations.length === 0) return fallbackName;
  const es = pickTranslation(translations, 'es');
  if (es?.['name']) return es['name'] as string;
  const en = pickTranslation(translations, 'en');
  if (en?.['name']) return en['name'] as string;
  return (translations[0]?.['name'] as string) || fallbackName;
}
