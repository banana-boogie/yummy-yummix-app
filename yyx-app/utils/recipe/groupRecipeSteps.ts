import { AdminRecipeSteps } from '@/types/recipe.admin.types';

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
    const sectionKey = `${step.recipeSectionEn || 'Main'}|${step.recipeSectionEs || 'Principal'}`;
    if (!groups[sectionKey]) {
      groups[sectionKey] = {
        sectionEn: step.recipeSectionEn || 'Main',
        sectionEs: step.recipeSectionEs || 'Principal',
        steps: []
      };
    }
    groups[sectionKey].steps.push(step);
  });

  return groups;
}; 