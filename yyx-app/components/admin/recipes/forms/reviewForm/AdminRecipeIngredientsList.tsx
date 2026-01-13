import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/common/Text';
import { AdminRecipeIngredientCard } from '@/components/admin/recipes/forms/ingredientsForm/AdminRecipeIngredientCard';
import { AdminRecipeIngredient } from '@/types/recipe.admin.types';

interface RecipeIngredientsListProps {
  ingredients: AdminRecipeIngredient[];
  title?: string;
  showSections?: boolean;
  hideActions?: boolean;
}

export const RecipeIngredientsList: React.FC<RecipeIngredientsListProps> = ({
  ingredients,
  title,
  showSections = true,
  hideActions = false
}) => {
  // Group ingredients by recipeSection
  const groupedIngredients = ingredients.reduce<Record<string, AdminRecipeIngredient[]>>((acc, ingredient) => {
    const recipeSection = ingredient.recipeSectionEn || ingredient.recipeSectionEs || '';
    if (!acc[recipeSection]) {
      acc[recipeSection] = [];
    }
    acc[recipeSection].push(ingredient);
    return acc;
  }, {});

  // Sort sections and ingredients by displayOrder
  const sortedSections = Object.entries(groupedIngredients).sort((a, b) => {
    // Sort sections by the minimum displayOrder of their ingredients
    const minOrderA = Math.min(...a[1].map(ing => ing.displayOrder || 0));
    const minOrderB = Math.min(...b[1].map(ing => ing.displayOrder || 0));
    return minOrderA - minOrderB;
  });

  const renderRecipeSection = (sectionTitle: string, sectionIngredients: AdminRecipeIngredient[]) => {
    // Sort ingredients by displayOrder
    const sortedIngredients = [...sectionIngredients].sort((a, b) =>
      (a.displayOrder || 0) - (b.displayOrder || 0)
    );

    return (
      <View key={sectionTitle} className="mb-md px-sm">
        {showSections && sectionTitle ? (
          <View className="flex-row justify-between items-center mb-sm pb-xs border-b border-border-default">
            <Text preset="subheading" fontWeight="600" className="flex-1">
              {sectionTitle}
            </Text>
          </View>
        ) : null}

        {sortedIngredients.map((ingredient, index) => (
          <AdminRecipeIngredientCard
            key={ingredient.id}
            recipeIngredient={ingredient}
            isFirst={index === 0}
            isLast={index === sortedIngredients.length - 1}
            hideActions={hideActions}
          />
        ))}
      </View>
    );
  };

  return (
    <View className="flex-1 w-full">
      {title && (
        <Text preset="h1" fontWeight="700" className="mb-md">
          {title}
        </Text>
      )}

      <ScrollView
        showsVerticalScrollIndicator={true}
        className="flex-1 rounded-md bg-background-SECONDARY"
        contentContainerStyle={{ padding: 8, paddingBottom: 16 }}
      >
        {sortedSections.map(([section, sectionIngredients]) =>
          renderRecipeSection(section, sectionIngredients)
        )}
      </ScrollView>
    </View>
  );
};

export default RecipeIngredientsList;