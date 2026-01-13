import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { RecipeIngredientCard } from './RecipeIngredientCard';
import i18n from '@/i18n';

import type { RecipeIngredient } from '@/types/recipe.types';
import { SectionHeading } from '@/components/recipe-detail/SectionHeading';
import { shouldDisplayRecipeSection } from '@/utils/recipes';

export interface RecipeIngredientsProps {
  ingredients: RecipeIngredient[];
  className?: string; // Add className
  style?: StyleProp<ViewStyle>;
}

export const groupIngredientsBySection = (ingredients: RecipeIngredient[]) => {
  return ingredients.reduce((acc, ingredient) => {
    const section = shouldDisplayRecipeSection(ingredient.recipeSection)
      ? (ingredient.recipeSection || '')
      : '';

    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(ingredient);
    return acc;
  }, {} as Record<string, RecipeIngredient[]>);
};


export const RecipeIngredients: React.FC<RecipeIngredientsProps> = ({
  ingredients,
  className = '',
  style
}) => {
  if (!ingredients || ingredients.length === 0) return null;

  const groupedIngredients = groupIngredientsBySection(ingredients);

  return (
    <View className={className} style={style}>
      <SectionHeading heading={i18n.t('recipes.detail.ingredients.heading')} />
      {Object.entries(groupedIngredients).map(([recipeSection, ingredients]) => (
        <View key={recipeSection} className="mb-md">
          {recipeSection ? (
            <Text preset="subheading" className="mb-xs">
              {recipeSection}
            </Text>
          ) : null}
          {ingredients.map((ingredient, index) => (
            <View
              key={`${ingredient.id}-${index}`}
              className="mb-xs"
            >
              <RecipeIngredientCard ingredient={ingredient} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
