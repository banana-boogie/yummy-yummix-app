/**
 * Shared recipe query row types used across edge functions.
 */

export interface RecipeIngredientJoinRow {
  ingredients: {
    name_en: string | null;
    name_es: string | null;
  } | null;
}

export interface RecipeTagJoinRow {
  recipe_tags: {
    name_en: string | null;
    name_es: string | null;
  } | null;
}

export interface RecipeStepRow {
  instruction_en: string | null;
  instruction_es: string | null;
  order: number;
}

export interface RecipeEmbeddingRow {
  id: string;
  name_en: string | null;
  name_es: string | null;
  tips_and_tricks_en: string | null;
  tips_and_tricks_es: string | null;
  recipe_ingredients: RecipeIngredientJoinRow[];
  recipe_to_tag: RecipeTagJoinRow[];
  recipe_steps: RecipeStepRow[];
}
