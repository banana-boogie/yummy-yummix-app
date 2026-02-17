import React from 'react';
import { View, ScrollView } from 'react-native';
import i18n from '@/i18n';
import { Text } from '@/components/common/Text';
import { AdminRecipe } from '@/types/recipe.admin.types';
import { RecipeInfo } from '@/components/recipe-detail/RecipeInfo';
import { RecipeIngredientsList } from '@/components/admin/recipes/forms/reviewForm/AdminRecipeIngredientsList';
import { RecipeStepsList } from '@/components/admin/recipes/forms/reviewForm/AdminRecipeStepsList';
import { RecipeTagsList } from '@/components/admin/recipes/forms/reviewForm/AdminRecipeTagsList';
import { RecipeUsefulItemsList } from '@/components/admin/recipes/forms/reviewForm/AdminRecipeUsefulItemsList';
import { Switch } from '@/components/common/Switch';
import { Image } from 'expo-image';

interface ReviewFormProps {
  recipe: Partial<AdminRecipe>;
  onUpdateRecipe?: (updates: Partial<AdminRecipe>) => void;
}

export function ReviewForm({ recipe, onUpdateRecipe }: ReviewFormProps) {
  // Toggle for isPublished field
  const handlePublishToggle = (value: boolean) => {
    if (onUpdateRecipe) {
      onUpdateRecipe({ isPublished: value });
    }
  };

  return (
    <ScrollView
      className="w-full max-w-[1000px] rounded-lg pt-md px-md mt-md mb-lg"
      style={{ backgroundColor: '#ffffff' }}
      showsVerticalScrollIndicator={false}
    >
      {/* Preview of recipe */}
      <View className="flex-col gap-lg rounded-lg">
        <Text preset="h1" className="mb-md">{`${recipe.nameEn}  |  ${recipe.nameEs}`}</Text>

        {recipe.pictureUrl ? (
          <View className="w-full h-[200px] rounded-lg mb-md overflow-hidden bg-background-SECONDARY">
            <Image
              source={recipe.pictureUrl}
              className="w-full h-full"
              contentFit="contain"
              transition={300}
              cachePolicy="memory-disk"
            />
          </View>
        ) : null}

        <View className="self-center">
          <RecipeInfo
            totalTime={recipe.totalTime || 0}
            prepTime={recipe.prepTime || 0}
            difficulty={recipe.difficulty}
          />
        </View>

        <View className="mb-md">
          <Text preset="h1" fontWeight="700" className="mb-md">
            {i18n.t('admin.recipes.form.reviewInfo.usefulItems')} ({recipe.usefulItems?.length || 0})
          </Text>
          <RecipeUsefulItemsList usefulItems={recipe.usefulItems || []} />
        </View>

        <View className="mb-md">
          <Text preset="h1" fontWeight="700" className="mb-md">
            {i18n.t('admin.recipes.form.reviewInfo.ingredients')} ({recipe.ingredients?.length || 0})
          </Text>
          <RecipeIngredientsList ingredients={recipe.ingredients || []} hideActions={true} />
        </View>

        <View>
          <Text preset="h1" fontWeight="700" className="mb-md">
            {i18n.t('admin.recipes.form.reviewInfo.steps')} ({recipe.steps?.length || 0})
          </Text>

          <RecipeStepsList recipeSteps={recipe.steps || []} />
        </View>


        <View>
          <Text preset="h1" fontWeight="700" className="mb-md">
            {i18n.t('admin.recipes.form.reviewInfo.tags')} ({recipe.tags?.length || 0})
          </Text>

          <RecipeTagsList tags={recipe.tags || []} />
        </View>

        <View className="flex-col justify-start items-center my-md py-xs px-sm rounded-sm">
          <Text preset="h1" fontWeight="700" className="mr-sm text-4xl">
            {i18n.t('admin.recipes.form.reviewInfo.publish')}
          </Text>
          <Switch
            value={recipe.isPublished ?? false}
            onValueChange={handlePublishToggle}
            containerStyle={{ transform: [{ scale: 1.5 }], marginTop: 8 }}
          />
        </View>
      </View>
    </ScrollView>
  );
}
