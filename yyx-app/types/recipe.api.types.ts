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

export interface KitchenToolTranslation {
  kitchen_tool_id: string;
  locale: string;
  name: string;
}

export interface RecipeIngredientTranslation {
  recipe_ingredient_id: string;
  locale: string;
  notes: string | null;
  recipe_section: string | null;
}

export interface RecipeKitchenToolTranslation {
  recipe_kitchen_tool_id: string;
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
  kitchen_tools?: RawRecipeKitchenTool[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
  translations: RecipeTranslation[];
}

// Raw Ingredient Types
export interface RawRecipeIngredient {
  quantity: number;
  ingredient: RawIngredient;
  measurement_unit: RawMeasurementUnit;
  translations?: RecipeIngredientTranslation[];
  display_order: number;
  optional: boolean;
}

export interface RawIngredient {
  id: string;
  image_url?: string;
  translations: IngredientTranslation[];
}

export interface RawMeasurementUnit {
  id: string;
  type: 'volume' | 'weight' | 'unit';
  system: 'metric' | 'imperial' | 'universal';
  translations: MeasurementUnitTranslation[];
}

// Raw Tag Types
export interface RawRecipeTag {
  recipe_tags: {
    id: string;
    categories: string[];
    translations: RecipeTagTranslation[];
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
  thermomix_mode?: string | null;
  timer_seconds?: number | null;
  step_ingredients?: RawStepIngredient[];
  translations: RecipeStepTranslation[];
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

export interface RawRecipeKitchenTool {
  id: string;
  recipe_id: string;
  kitchen_tool_id: string;
  display_order: number;
  kitchen_tool: RawKitchenTool;
  translations?: RecipeKitchenToolTranslation[];
}

export interface RawKitchenTool {
  id: string;
  image_url: string;
  translations: KitchenToolTranslation[];
}
