import { RecipeDifficulty } from "./recipe.types";
import { ThermomixSpeedValue, ThermomixTemperature, ThermomixTemperatureUnit } from "./thermomix.types";

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
  [key: `name_${string}`]: string;
  [key: `tips_and_tricks_${string}`]: string;
}

// Raw Ingredient Types
export interface RawRecipeIngredient {
  quantity: number;
  ingredient: RawIngredient;
  measurement_unit: RawMeasurementUnit;
  notes_en?: string;
  notes_es?: string;
  recipe_section_en?: string;
  recipe_section_es?: string;
  display_order: number;
  optional: boolean;
}

export interface RawIngredient {
  id: string;
  name_en?: string;
  name_es?: string;
  plural_name_en?: string;
  plural_name_es?: string;
  image_url?: string;
}

export interface RawMeasurementUnit {
  id: string;
  type: 'volume' | 'weight' | 'unit';
  system: 'metric' | 'imperial' | 'universal';
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
    name_en: string | null;
    name_es: string | null;
    categories: string[];
  }
}

export interface RawRecipeStep {
  id: string;
  recipe_id: string;
  order: number;
  recipe_section_en: string | null;
  recipe_section_es: string | null;
  instruction_en: string;
  instruction_es: string;
  thermomix_time: number | null;
  thermomix_speed: ThermomixSpeedValue;
  thermomix_speed_start: ThermomixSpeedValue;
  thermomix_speed_end: ThermomixSpeedValue;
  thermomix_temperature: ThermomixTemperature | null;
  thermomix_temperature_unit: ThermomixTemperatureUnit | null;
  thermomix_is_blade_reversed: boolean | null;
  step_ingredients?: RawStepIngredient[];
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
  notes_en?: string;
  notes_es?: string;
  useful_item: RawUsefulItem;
}

export interface RawUsefulItem {
  id: string;
  name_en: string;
  name_es: string;
  image_url: string;
}