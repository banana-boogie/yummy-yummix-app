// components/RecipeCard.tsx
import React from 'react';
import { Pressable, View, StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Recipe } from '@/types/recipe.types';
import { RecipeImage } from '@/components/recipe/RecipeImage';
import { Text } from '@/components/common';
import { RecipeInfo } from '../recipe-detail/RecipeInfo';
import { StarRating } from '@/components/rating/StarRating';

interface RecipeCardProps {
  recipe: Recipe;
  featured?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

// Using React.memo to prevent unnecessary re-renders
export const RecipeCard = React.memo(function RecipeCard({
  recipe,
  featured = false,
  className = '',
  style
}: RecipeCardProps) {
  const router = useRouter();

  // Skip rendering if required data is missing
  if (!recipe.name) {
    return null;
  }

  const handlePress = async () => {
    await Haptics.selectionAsync();
    router.push(`/(tabs)/recipes/${recipe.id}`);
  };

  const hasRating = recipe.ratingCount && recipe.ratingCount > 0 && recipe.averageRating;

  return (
    <View
      className={`bg-white rounded-md shadow-md ${className}`}
      style={style}
    >
      <Pressable
        testID="recipe-card-pressable"
        className="active:opacity-70"
        onPress={handlePress}
      >
        <View className={`p-md pb-lg rounded-sm ${featured ? 'p-md' : ''}`}>
          <View className="w-full overflow-hidden mb-3">
            <RecipeImage
              pictureUrl={recipe.pictureUrl}
              className="w-full rounded-xs"
              aspectRatio={featured ? 21 / 9 : 16 / 9}
              width='100%'
            />
          </View>
          <View className={`w-full ${featured ? 'px-sm' : ''}`}>
            <Text preset="h1" className="mb-xs">{recipe.name}</Text>
            <View className="flex-row items-center flex-wrap gap-x-sm">
              {hasRating && (
                <StarRating
                  rating={recipe.averageRating!}
                  size="sm"
                  showCount
                  count={recipe.ratingCount}
                />
              )}
              {recipe.totalTime && recipe.prepTime && (
                <RecipeInfo
                  totalTime={recipe.totalTime}
                  prepTime={recipe.prepTime}
                  difficulty={recipe.difficulty}
                />
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
});