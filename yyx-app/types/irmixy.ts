/**
 * Client-side types for Irmixy AI responses.
 * These mirror the server-side IrmixyResponse schema.
 */

export interface RecipeCard {
  recipeId: string;
  name: string;
  imageUrl?: string;
  totalTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  portions: number;
}

export interface SuggestionChip {
  label: string;
  message: string;
}

export interface QuickAction {
  type: 'start_cooking' | 'view_recipe' | 'save_recipe' | 'set_timer';
  label: string;
  payload: Record<string, unknown>;
}

export interface GeneratedIngredient {
  name: string;
  quantity: number;
  unit: string;
  imageUrl?: string;
}

export interface GeneratedStep {
  order: number;
  instruction: string;
  ingredientsUsed?: string[]; // Names of ingredients used in this step
  thermomixTime?: number;
  thermomixTemp?: string;
  thermomixSpeed?: string;
}

export interface GeneratedUsefulItem {
  name: string;
  imageUrl?: string;
  notes?: string;
}

export interface GeneratedRecipe {
  schemaVersion: '1.0';
  suggestedName: string;
  measurementSystem: 'imperial' | 'metric';
  language: 'en' | 'es';
  ingredients: GeneratedIngredient[];
  steps: GeneratedStep[];
  totalTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  portions: number;
  tags: string[];
  usefulItems?: GeneratedUsefulItem[];
}

export interface SafetyFlags {
  allergenWarning?: string;
  dietaryConflict?: string;
  error?: boolean;
}

export interface IrmixyResponse {
  version: '1.0';
  message: string;
  language: 'en' | 'es';
  status?: 'thinking' | 'searching' | 'generating' | null;
  recipes?: RecipeCard[];
  customRecipe?: GeneratedRecipe;
  suggestions?: SuggestionChip[];
  actions?: QuickAction[];
  memoryUsed?: string[];
  safetyFlags?: SafetyFlags;
}

export type IrmixyStatus = 'thinking' | 'searching' | 'generating' | null;
