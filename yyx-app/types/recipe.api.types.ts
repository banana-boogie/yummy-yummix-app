import { RecipeDifficulty } from "./recipe.types";
import { ThermomixSpeedValue, ThermomixTemperature, ThermomixTemperatureUnit } from "./thermomix.types";

// ============================================================
// Translation row types — one per locale
// ============================================================

export interface RecipeTranslation {
  recipe_id: string;
  locale: string;
  name: string;
  tips_and_tricks: string | null;
}

export interface RecipeStepTranslation {
  recipe_step_id: string;
  locale: string;
  instruction: string;
  recipe_section: string | null;
  tip: string | null;
}

export interface IngredientTranslation {
  ingredient_id: string;
  locale: string;
  name: string;
  plural_name: string | null;
}

export interface MeasurementUnitTranslation {
  measurement_unit_id: string;
  locale: string;
  name: string;
  name_plural: string;
  symbol: string;
  symbol_plural: string;
}

export interface RecipeTagTranslation {
  recipe_tag_id: string;
  locale: string;
  name: string;
}

export interface UsefulItemTranslation {
  useful_item_id: string;
  locale: string;
  name: string;
}

export interface RecipeIngredientTranslation {
  recipe_ingredient_id: string;
  locale: string;
  notes: string | null;
  recipe_section: string | null;
}

export interface RecipeUsefulItemTranslation {
  recipe_useful_item_id: string;
  locale: string;
  notes: string | null;
}

// ============================================================
// Raw entity types — with translations array
// ============================================================

export interface RawRecipe {
  id: string;
  image_url?: string;
  difficulty: RecipeDifficulty;
  prep_time: number;
  total_time: number;
  portions?: number;
  ingredients?: RawRecipeIngredient[];
  tags?: RawRecipeTag[];
  steps?: RawRecipeStep[];
  useful_items?: RawRecipeUsefulItem[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
  translations: RecipeTranslation[];
  // Legacy fields — kept for write compatibility
  [key: `name_${string}`]: string;
  [key: `tips_and_tricks_${string}`]: string;
}

// Raw Ingredient Types
export interface RawRecipeIngredient {
  quantity: number;
  ingredient: RawIngredient;
  measurement_unit: RawMeasurementUnit;
  translations?: RecipeIngredientTranslation[];
  display_order: number;
  optional: boolean;
  // Legacy write fields
  notes_en?: string;
  notes_es?: string;
  recipe_section_en?: string;
  recipe_section_es?: string;
}

export interface RawIngredient {
  id: string;
  image_url?: string;
  translations: IngredientTranslation[];
  // Legacy write fields
  name_en?: string;
  name_es?: string;
  plural_name_en?: string;
  plural_name_es?: string;
}

export interface RawMeasurementUnit {
  id: string;
  type: 'volume' | 'weight' | 'unit';
  system: 'metric' | 'imperial' | 'universal';
  translations: MeasurementUnitTranslation[];
  // Legacy write fields
  name_en: string;
  name_en_plural: string;
  symbol_en: string;
  symbol_en_plural: string;
  name_es: string;
  name_es_plural: string;
  symbol_es: string;
  symbol_es_plural: string;
}

// Raw Tag Types
export interface RawRecipeTag {
  recipe_tags: {
    id: string;
    categories: string[];
    translations: RecipeTagTranslation[];
    // Legacy write fields
    name_en: string | null;
    name_es: string | null;
  }
}

export interface RawRecipeStep {
  id: string;
  recipe_id: string;
  order: number;
  thermomix_time: number | null;
  thermomix_speed: ThermomixSpeedValue;
  thermomix_speed_start: ThermomixSpeedValue;
  thermomix_speed_end: ThermomixSpeedValue;
  thermomix_temperature: ThermomixTemperature | null;
  thermomix_temperature_unit: ThermomixTemperatureUnit | null;
  thermomix_is_blade_reversed: boolean | null;
  step_ingredients?: RawStepIngredient[];
  translations: RecipeStepTranslation[];
  // Legacy write fields
  recipe_section_en: string | null;
  recipe_section_es: string | null;
  instruction_en: string;
  instruction_es: string;
}

export interface RawStepIngredient {
  id: string;
  recipe_id: string;
  recipe_step_id: string;
  ingredient_id: string;
  measurement_unit_id: string;
  quantity: number;
  ingredient: RawIngredient;
  measurement_unit: RawMeasurementUnit;
  display_order: number;
  optional: boolean;
}

export interface RawRecipeUsefulItem {
  id: string;
  recipe_id: string;
  useful_item_id: string;
  display_order: number;
  useful_item: RawUsefulItem;
  translations?: RecipeUsefulItemTranslation[];
  // Legacy write fields
  notes_en?: string;
  notes_es?: string;
}

export interface RawUsefulItem {
  id: string;
  image_url: string;
  translations: UsefulItemTranslation[];
  // Legacy write fields
  name_en: string;
  name_es: string;
}
