import { ThermomixSettings } from "./thermomix.types";

// Core Recipe Types
export interface Recipe {
  id: string;
  name: string;
  pictureUrl?: string;
  difficulty: RecipeDifficulty;
  prepTime: number | null;
  totalTime: number | null;
  portions?: number;
  steps?: RecipeStep[];
  tipsAndTricks?: string;
  ingredients: RecipeIngredient[];
  tags?: RecipeTag[];
  usefulItems?: RecipeUsefulItem[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  // Rating fields
  averageRating?: number | null;
  ratingCount?: number;
}

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
  name: string;
  categories: string[];
}

// Useful Item Related Types
export interface RecipeUsefulItem {
  id: string;
  name: string;
  pictureUrl: string;
  displayOrder: number;
  notes: string;
}
