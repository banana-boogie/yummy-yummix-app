import { AdminRecipeSteps, getTranslatedField } from '@/types/recipe.admin.types';

export interface GroupedRecipeSteps {
  [key: string]: {
    sectionEn: string;
    sectionEs: string;
    steps: AdminRecipeSteps[];
  };
}

export const groupRecipeSteps = (steps: AdminRecipeSteps[]): GroupedRecipeSteps => {
  const groups: GroupedRecipeSteps = {};

  steps.forEach(step => {
    const sectionEn = getTranslatedField(step.translations, 'en', 'recipeSection') || 'Main';
    const sectionEs = getTranslatedField(step.translations, 'es', 'recipeSection') || 'Principal';
    const sectionKey = `${sectionEn}|${sectionEs}`;
    if (!groups[sectionKey]) {
      groups[sectionKey] = {
        sectionEn,
        sectionEs,
        steps: []
      };
    }
    groups[sectionKey].steps.push(step);
  });

  return groups;
};
