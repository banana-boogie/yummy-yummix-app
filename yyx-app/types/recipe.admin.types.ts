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

/**
 * Policy: any new free-form user-facing text field on a recipe must be added
 * to recipe_translations (this type), not the base `recipes` table. The base
 * table holds only enums, numbers, booleans, and tag references. Free-form
 * text requires per-locale authoring so that Spanish users never fall back to
 * English content, and vice versa.
 */
export interface AdminRecipeTranslation extends EntityTranslation {
  name: string;
  description?: string;
  tipsAndTricks?: string;
  scalingNotes?: string;
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
  defaultCategoryId?: string | null;
}

export interface AdminKitchenTool {
  id: string;
  translations: AdminKitchenToolTranslation[];
  pictureUrl: string;
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
  thermomixMode?: string | null;
  /** Explicit timer duration in seconds for non-Thermomix steps. */
  timerSeconds?: number | null;
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

// Pairing roles for `recipe_pairings.pairing_role`.
//
// Mirrors the CHECK constraint in
// yyx-server/supabase/migrations/20260410000001_add_meal_plans.sql
// as widened by 20260423190515_add_main_to_pairing_roles.sql. The
// TypeScript union is derived from this const array so keeping the
// runtime list and the type in sync requires a single edit here.
export const PAIRING_ROLES = [
  'main',
  'side',
  'base',
  'veg',
  'dessert',
  'beverage',
  'condiment',
  'leftover_transform',
] as const;

export type PairingRole = typeof PAIRING_ROLES[number];

// Subset of PlannerRole values that map directly to a PairingRole when a
// target recipe is picked. E.g., a target recipe with planner_role='main'
// defaults to pairing_role='main'. Others (snack, pantry, null) require
// the admin to pick explicitly.
export const DIRECT_PAIRING_ROLE_MAP = new Set<PairingRole>([
  'main',
  'side',
  'dessert',
  'beverage',
  'condiment',
]);

export interface AdminRecipePairing {
  id?: string;
  sourceRecipeId: string;
  targetRecipeId: string;
  pairingRole: PairingRole | null;
  reason?: string | null;
  // UI-derived from target recipe join — not persisted back.
  /** Raw translations array from the target recipe. Rendered against the
   *  active display locale at the UI layer so locale toggles do not require
   *  a refetch of the parent recipe. */
  targetTranslations?: { locale: string; name?: string }[];
  /** Pre-resolved display name, used only for locally-added pairings (from
   *  the picker) where only one locale's name was picked. Persisted pairings
   *  carry `targetTranslations` instead and this field is unset. */
  targetName?: string;
  targetImageUrl?: string | null;
  targetPlannerRole?: string | null;
}

export interface AdminRecipe extends Omit<Recipe, 'name' | 'ingredients' | 'tags' | 'steps' | 'kitchenTools'> {
  translations: AdminRecipeTranslation[];
  ingredients: AdminRecipeIngredient[];
  tags: AdminRecipeTag[];
  steps: AdminRecipeSteps[];
  kitchenTools?: AdminRecipeKitchenTool[];
  pairings?: AdminRecipePairing[];
  // Derived, read-only — resolved from user_profiles at fetch time.
  verifiedByName?: string | null;
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
  if (!translations || !locale || typeof locale !== 'string') return undefined;
  // Exact match first
  const exact = translations.find(t => typeof t.locale === 'string' && t.locale === locale);
  if (exact) return exact;
  // Fall back to base language (e.g., es-ES → es)
  if (locale.includes('-')) {
    const base = locale.split('-')[0];
    return translations.find(t => typeof t.locale === 'string' && t.locale === base);
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
