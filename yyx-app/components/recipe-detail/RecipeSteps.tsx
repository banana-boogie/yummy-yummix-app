import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/common/Text';
import { RecipeStep, RecipeStepIngredient } from '@/types/recipe.types';
import { SectionHeading } from '@/components/recipe-detail/SectionHeading';
import { renderRecipeText } from '@/components/recipe-detail/RenderRecipeText';
import i18n from '@/i18n';
import { SectionSubHeading } from '@/components/recipe-detail/SectionSubHeading';
import { shouldDisplayRecipeSection } from '@/utils/recipes';
import { COLORS, FONT_SIZES } from '@/constants/design-tokens';

type RecipeStepsProps = {
  steps: RecipeStep[] | undefined;
  className?: string; // Add className
  style?: StyleProp<ViewStyle>;
};

const numberBackground = require('@/assets/images/backgrounds/watercolour-circle.png');

export const RecipeSteps = ({ steps, className = '', style }: RecipeStepsProps) => {
  if (!steps || steps.length === 0) return null;

  // Group by section (no sorting needed)
  const groupedSteps = steps.reduce((acc, step) => {
    const sectionKey = step.recipeSection || '';
    if (!acc[sectionKey]) {
      acc[sectionKey] = [];
    }
    acc[sectionKey].push(step);
    return acc;
  }, {} as Record<string, RecipeStep[]>);

  return (
    <View className={className} style={style}>
      <SectionHeading heading={i18n.t('recipes.detail.steps.heading')} />
      {Object.entries(groupedSteps).map(([section, sectionSteps]) => (
        <View key={section}>
          {section && shouldDisplayRecipeSection(section) ?
            <SectionSubHeading heading={section} /> : null}

          <View className="gap-xl">
            {sectionSteps.map((step) => (
              <StepItem key={step.id} step={step} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

// Helper to convert step ingredients to format needed for highlighting
const getIngredientNames = (ingredients?: RecipeStepIngredient[]) => {
  if (!ingredients) return undefined;
  return ingredients.map(ing => ({
    name: ing.name,
    pluralName: ing.pluralName,
  }));
};

// Extract step rendering to a separate component for reuse
const StepItem = React.memo(({ step }: { step: RecipeStep }) => (
  <View className="flex-row items-start lg:mb-lg">
    <View className="w-[60px] h-[60px] justify-center items-center mr-md mt-0 relative">
      <Image
        source={numberBackground}
        className="w-full h-full"
        contentFit="cover"
        transition={300}
        cachePolicy="memory-disk"
      />
      <Text className="text-xl font-bold text-text-default absolute text-center leading-none">{step.order}</Text>
    </View>
    <View className="flex-1 pr-md mb-xl pt-1">
      {renderRecipeText(step.instruction, {
        textStyle: { fontSize: FONT_SIZES.xl, lineHeight: 36 },
        boldStyle: { color: COLORS.primary.dark, fontSize: FONT_SIZES['2xl'] },
      }, getIngredientNames(step.ingredients))}
    </View>
  </View>
));