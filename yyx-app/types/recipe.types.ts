import { ThermomixSettings } from "./thermomix.types";

// Core Recipe Types
export interface Recipe {
  id: string;
  name: string;
  description?: string;
  pictureUrl?: string;
  difficulty: RecipeDifficulty;
  prepTime: number | null;
  totalTime: number | null;
  portions?: number;
  steps?: RecipeStep[];
  tipsAndTricks?: string;
  ingredients: RecipeIngredient[];
  tags?: RecipeTag[];
  kitchenTools?: RecipeKitchenTool[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  // Planner (Meal Planning) metadata
  plannerRole?: PlannerRole | null;
  alternatePlannerRoles?: AlternatePlannerRole[] | null;
  mealComponents?: MealComponent[] | null;
  isCompleteMeal?: boolean | null;
  equipmentTags?: EquipmentTag[] | null;
  cookingLevel?: CookingLevel | null;
  leftoversFriendly?: boolean | null;
  batchFriendly?: boolean | null;
  maxHouseholdSizeSupported?: number | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
}

// Planner-related enums (stored as TEXT / TEXT[] in DB).
//
// Mirrors the CHECK constraint on `recipes.planner_role` in
// yyx-server/supabase/migrations/20260415120000_recipe_role_model_extension.sql.
// Keep these in sync: the TypeScript union below is DERIVED from this const
// array so adding/removing a role is a single edit that updates both the
// type and the runtime list used by admin forms and tests.
export const PLANNER_ROLES = [
  'main',
  'side',
  'snack',
  'dessert',
  'beverage',
  'condiment',
  'pantry',
] as const;

export type PlannerRole = typeof PLANNER_ROLES[number];

// Alternate slot-type eligibility — same as PlannerRole minus 'pantry',
// which is mutually exclusive with scheduling.
export const ALTERNATE_PLANNER_ROLES = PLANNER_ROLES.filter(
  (r): r is Exclude<PlannerRole, 'pantry'> => r !== 'pantry',
);

export type AlternatePlannerRole = Exclude<PlannerRole, 'pantry'>;

/**
 * What a recipe contributes to a complete meal.
 *
 * Renamed from the earlier `FoodGroup` which mixed macronutrient values
 * (protein/carb/veg) with course identity (snack/dessert) on one axis.
 * This type captures only the meal-composition axis; course identity
 * lives on `planner_role` and dietary descriptors live in the `diet`
 * tag category.
 */
export type MealComponent = 'protein' | 'carb' | 'veg';
export type EquipmentTag = 'thermomix' | 'air_fryer' | 'oven' | 'stovetop' | 'none';
export type CookingLevel = 'beginner' | 'intermediate' | 'experienced';

// Enums
export enum RecipeDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard'
}

// Ingredient Related Types
export interface RecipeIngredient {
  id: string;
  name: string;
  pluralName: string;
  pictureUrl?: string;
  quantity: string;
  measurementUnit: MeasurementUnit;
  formattedQuantity: string; // use for display purposes
  formattedUnit: string; // use for display purposes
  notes?: string;
  displayOrder: number;
  optional: boolean;
  recipeSection: string;
}

export interface MeasurementUnit {
  id: string;
  type: 'volume' | 'weight' | 'unit';
  system: 'metric' | 'imperial' | 'universal';
  name: string;
  symbol: string;
  symbolPlural: string;
}
// For transformed/frontend use
export interface RecipeStep {
  id: string;
  order: number;
  instruction: string;
  recipeSection: string | null;
  thermomix?: ThermomixSettings;
  tip?: string | null;
  /** Explicit timer duration in seconds for non-Thermomix steps. */
  timerSeconds?: number | null;
  ingredients: RecipeStepIngredient[];
}

export interface RecipeStepIngredient {
  id: string;
  name: string;
  pluralName: string;
  pictureUrl?: string;
  quantity: string;
  measurementUnit: MeasurementUnit;
  formattedQuantity: string;
  formattedUnit: string;
  displayOrder: number;
  optional: boolean;
}

// Tag Related Types
export interface RecipeTag {
  id: string;
  slug: string | null;
  name: string;
  categories: string[];
}

// Kitchen Tool Related Types
export interface RecipeKitchenTool {
  id: string;
  name: string;
  pictureUrl: string;
  displayOrder: number;
  notes: string;
}
