import { Recipe } from '@/types/recipe.types';
import { ThermomixSpeed, ThermomixTemperature, ThermomixTemperatureUnit } from '@/types/thermomix.types';

export interface NutritionalFacts {
  per_100g: {
    calories: number | string | undefined;
    protein: number | string | undefined;
    fat: number | string | undefined;
    carbohydrates: number | string | undefined;
  };
}

export interface AdminMeasurementUnit {
  id: string;
  type: 'volume' | 'weight' | 'unit';
  system: 'metric' | 'imperial' | 'universal';
  nameEn: string;
  nameEs: string;
  symbolEn: string;
  symbolEs: string;
}

export interface AdminIngredient {
  id: string;
  nameEn: string;
  nameEs: string;
  pluralNameEn: string;
  pluralNameEs: string;
  pictureUrl: string;
  nutritionalFacts: NutritionalFacts;
}

export interface AdminUsefulItem {
  id: string;
  nameEn: string;
  nameEs: string;
  pictureUrl: string | any;
}

export interface AdminRecipeIngredient {
  id: string;
  ingredientId: string;
  ingredient: AdminIngredient;
  quantity: string;
  recipeSectionEn: string;
  recipeSectionEs: string;
  notesEn?: string;
  notesEs?: string;
  tipEn?: string;
  tipEs?: string;
  optional: boolean;
  displayOrder: number;
  measurementUnit: AdminMeasurementUnit;
}

export interface AdminRecipeTag {
  id: string;
  nameEn: string;
  nameEs: string;
  categories: string[];
}

export interface AdminRecipeSteps {
  id: string;
  order: number;
  instructionEn: string;
  instructionEs: string;
  thermomixTime?: number | null;
  thermomixSpeed?: ThermomixSpeed;
  thermomixTemperature?: ThermomixTemperature | null;
  thermomixTemperatureUnit?: ThermomixTemperatureUnit | null;
  thermomixIsBladeReversed? : boolean | null;
  recipeSectionEn?: string;
  recipeSectionEs?: string;
  tipEn?: string;
  tipEs?: string;
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

export interface AdminRecipeUsefulItem {
  id: string;
  recipeId: string;
  usefulItemId: string;
  displayOrder: number;
  notesEn?: string;
  notesEs?: string;
  usefulItem: AdminUsefulItem;
}

export interface AdminRecipe extends Omit<Recipe, 'name' | 'ingredients' | 'tags' | 'steps' | 'usefulItems'> {
  nameEn: string;
  nameEs: string;
  tipsAndTricksEn?: string;
  tipsAndTricksEs?: string;
  ingredients: AdminRecipeIngredient[];
  tags: AdminRecipeTag[];
  steps: AdminRecipeSteps[];
  usefulItems?: AdminRecipeUsefulItem[];
} 