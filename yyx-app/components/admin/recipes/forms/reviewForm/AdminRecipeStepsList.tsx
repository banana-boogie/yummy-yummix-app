import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';
import { RecipeStepContent } from '@/components/admin/recipes/forms/shared/RecipeStepContent';
import { AdminRecipeSteps } from '@/types/recipe.admin.types';
import { groupRecipeSteps } from '@/utils/admin/recipe/groupRecipeSteps';

interface RecipeStepsListProps {
  recipeSteps: AdminRecipeSteps[];
}

export function RecipeStepsList({ recipeSteps }: RecipeStepsListProps) {
  const sortedRecipeSteps = React.useMemo(() => {
    return [...recipeSteps].sort((a, b) => a.order - b.order);
  }, [recipeSteps]);

  const groupedSteps = React.useMemo(() => {
    return groupRecipeSteps(sortedRecipeSteps);
  }, [sortedRecipeSteps]);

  return (
    <View className="mb-md">
      {Object.entries(groupedSteps).map(([sectionKey, { sectionEn, sectionEs, steps }]) => (
        <View key={sectionKey} className="mb-lg">
          <View className="mb-md pb-xs border-b border-border-default">
            <View className="flex-row items-center gap-sm">
              <Text preset="subheading" fontWeight="700" className="mb-0">
                {sectionEn}
              </Text>
              <Text preset="caption" className="mb-0">
                |
              </Text>
              <Text preset="subheading" fontWeight="700" className="mb-0 text-primary-dark">
                {sectionEs}
              </Text>
            </View>
          </View>
          {steps.map((recipeStep, index) => (
            <View key={`${recipeStep.id}-${index}`} className="bg-background-default rounded-md overflow-hidden mb-xl shadow-md">
              <View className="flex-row items-center bg-background-SECONDARY py-xs px-sm border-b border-border-default">
                <View className="bg-primary-default w-7 h-7 rounded-full items-center justify-center mr-sm">
                  <Text preset="body" fontWeight="700" color="#FFFFFF" className="pt-[2px]">
                    {recipeStep.order}
                  </Text>
                </View>
              </View>

              <RecipeStepContent
                recipeStep={recipeStep}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export default RecipeStepsList;