/**
 * Shared recipe query row types used across edge functions.
 *
 * Uses translation table joins instead of _en/_es columns.
 * During the transition period, the old columns still exist in the DB,
 * but backend reads go through translation tables.
 */

export interface TranslationRow {
  locale: string;
  name?: string | null;
}

export interface IngredientTranslationRow {
  locale: string;
  name: string | null;
  plural_name?: string | null;
}

export interface RecipeIngredientJoinRow {
  ingredients: {
    ingredient_translations: IngredientTranslationRow[];
  } | null;
}

export interface RecipeTagJoinRow {
  recipe_tags: {
    recipe_tag_translations: TranslationRow[];
  } | null;
}

export interface RecipeStepTranslationRow {
  locale: string;
  instruction: string | null;
}

export interface RecipeStepRow {
  order: number;
  recipe_step_translations: RecipeStepTranslationRow[];
}

export interface RecipeTranslationRow {
  locale: string;
  name: string | null;
  tips_and_tricks?: string | null;
}

export interface RecipeEmbeddingRow {
  id: string;
  recipe_translations: RecipeTranslationRow[];
  recipe_ingredients: RecipeIngredientJoinRow[];
  recipe_to_tag: RecipeTagJoinRow[];
  recipe_steps: RecipeStepRow[];
}
