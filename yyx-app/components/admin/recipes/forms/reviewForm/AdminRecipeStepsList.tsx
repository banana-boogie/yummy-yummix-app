import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';
import { RecipeStepContent } from '@/components/admin/recipes/forms/shared/RecipeStepContent';
import { AdminRecipeSteps } from '@/types/recipe.admin.types';
import { groupRecipeSteps } from '@/utils/admin/recipe/groupRecipeSteps';

interface RecipeStepsListProps {
  recipeSteps: AdminRecipeSteps[];
  displayLocale?: string;
}

export function RecipeStepsList({ recipeSteps, displayLocale = 'es' }: RecipeStepsListProps) {
  const sortedRecipeSteps = React.useMemo(() => {
    return [...recipeSteps].sort((a, b) => a.order - b.order);
  }, [recipeSteps]);

  const groupedSteps = React.useMemo(() => {
    return groupRecipeSteps(sortedRecipeSteps);
  }, [sortedRecipeSteps]);

  return (
    <View className="mb-md">
      {Object.entries(groupedSteps).map(([sectionKey, { sectionEn, sectionEs, steps }]) => {
        const sectionName = displayLocale === 'es' ? sectionEs : sectionEn;
        return (
        <View key={sectionKey} className="mb-lg">
          <View className="mb-md pb-xs border-b border-border-default">
            <Text preset="subheading" fontWeight="700" className="mb-0">
              {sectionName}
            </Text>
          </View>
          {steps.map((recipeStep, index) => (
            <View key={`${recipeStep.id}-${index}`} className="bg-background-default rounded-md overflow-hidden mb-xl shadow-md">
              <View className="flex-row items-center bg-background-secondary py-xs px-sm border-b border-border-default">
                <View className="bg-primary-default w-7 h-7 rounded-full items-center justify-center mr-sm">
                  <Text preset="body" fontWeight="700" color="#FFFFFF" className="pt-[2px]">
                    {recipeStep.order}
                  </Text>
                </View>
              </View>

              <RecipeStepContent
                recipeStep={recipeStep}
                displayLocale={displayLocale}
              />
            </View>
          ))}
        </View>
        );
      })}
    </View>
  );
}

export default RecipeStepsList;