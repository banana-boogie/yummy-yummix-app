import { AdminRecipe } from '@/types/recipe.admin.types';
import i18n from '@/i18n';

export const useRecipeValidation = () => {
  const validateBasicInfo = (recipe: Partial<AdminRecipe>): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!recipe.nameEn && !recipe.nameEs) {
      errors.name = i18n.t('admin.recipes.form.errors.nameRequired');
    }
    if (!recipe.difficulty) {
      errors.difficulty = i18n.t('admin.recipes.form.errors.difficultyRequired');
    }
    if (!recipe.prepTime) {
      errors.prepTime = i18n.t('admin.recipes.form.errors.prepTimeRequired');
    }
    if (!recipe.totalTime) {
      errors.totalTime = i18n.t('admin.recipes.form.errors.totalTimeRequired');
    }
    if (!recipe.portions) {
      errors.portions = i18n.t('admin.recipes.form.errors.portionsRequired');
    }
    if (!recipe.pictureUrl) {
      errors.pictureUrl = i18n.t('admin.recipes.form.errors.imageRequired');
    }

    return errors;
  };

  const validateIngredients = (recipe: Partial<AdminRecipe>): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!recipe.ingredients || recipe.ingredients.length === 0) {
      errors.ingredients = i18n.t('admin.recipes.form.errors.ingredientsRequired');
    }

    return errors;
  };

  const validateSteps = (recipe: Partial<AdminRecipe>): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!recipe.steps || recipe.steps.length === 0) {
      errors.steps = i18n.t('admin.recipes.form.errors.stepsRequired');
    }

    return errors;
  };

  const validateTags = (recipe: Partial<AdminRecipe>): Record<string, string> => {
    const errors: Record<string, string> = {};
    // Add tag validation if needed in the future
    return errors;
  };

  // Validate all sections at once
  const validateRecipe = (recipe: Partial<AdminRecipe>): Record<string, string> => {
    return {
      ...validateBasicInfo(recipe),
      ...validateIngredients(recipe),
      ...validateSteps(recipe),
      ...validateTags(recipe),
    };
  };

  return {
    validateRecipe,
    validateBasicInfo,
    validateIngredients,
    validateSteps,
    validateTags,
  };
}; 