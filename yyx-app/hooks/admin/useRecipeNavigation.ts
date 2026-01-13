import { CreateRecipeStep } from '@/components/admin/recipes/RecipeProgressIndicator';
import { AdminRecipe } from '@/types/recipe.admin.types';
import i18n from '@/i18n';

export const useRecipeNavigation = (recipe: Partial<AdminRecipe>, currentStep: CreateRecipeStep) => {
  const getNextButtonLabel = () => {
    if (currentStep < CreateRecipeStep.REVIEW) {
      return i18n.t('common.next');
    }

    return recipe.isPublished
      ? i18n.t('admin.recipes.form.publish')
      : i18n.t('admin.recipes.form.saveAsDraft');
  };

  return {
    getNextButtonLabel,
  };
}; 