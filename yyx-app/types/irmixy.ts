/**
 * Client-side types for Irmixy AI responses.
 * These mirror the server-side IrmixyResponse schema.
 */

export interface RecipeCard {
  recipeId: string;
  recipeTable?: 'recipes' | 'user_recipes';
  name: string;
  imageUrl?: string;
  totalTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  portions: number;
  allergenWarnings?: string[];
  allergenVerificationWarning?: string;
}

export interface Action {
  id: string;
  type: 'start_cooking' | 'view_recipe' | 'save_recipe' | 'set_timer' | 'resume_cooking' | 'share_recipe' | 'add_to_cookbook' | 'view_cookbook';
  label: string;
  payload: Record<string, unknown>;
  autoExecute?: boolean;
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
  tip?: string | null;
}

export interface GeneratedKitchenTool {
  name: string;
  imageUrl?: string;
  notes?: string;
}

export interface GeneratedRecipe {
  schemaVersion: '1.0';
  suggestedName: string;
  description?: string;
  measurementSystem: 'imperial' | 'metric';
  locale: string;
  ingredients: GeneratedIngredient[];
  steps: GeneratedStep[];
  totalTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  portions: number;
  tags: string[];
  kitchenTools?: GeneratedKitchenTool[];
}

export interface SafetyFlags {
  allergenWarning?: string;
  dietaryConflict?: string;
  error?: boolean;
}

export interface IrmixyResponse {
  version: '1.0';
  message: string;
  locale: string;
  status?: 'thinking' | 'searching' | 'generating' | 'cooking_it_up' | null;
  recipes?: RecipeCard[];
  customRecipe?: GeneratedRecipe;
  isAIGenerated?: boolean;
  actions?: Action[];
  memoryUsed?: string[];
  safetyFlags?: SafetyFlags;
}

export type IrmixyStatus =
  | 'thinking'
  | 'searching'
  | 'generating'
  | 'cooking_it_up'
  | 'enriching'
  | null;
