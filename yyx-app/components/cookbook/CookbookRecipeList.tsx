import React, { useMemo, useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Text } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import { CookbookRecipe } from '@/types/cookbook.types';
import { RecipeImage } from '@/components/recipe/RecipeImage';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useRemoveRecipeFromCookbook } from '@/hooks/useCookbookQuery';
import i18n from '@/i18n';

interface CookbookRecipeListProps {
  recipes: CookbookRecipe[];
  cookbookId: string;
  isOwner: boolean; // Whether the current user owns this cookbook
  emptyMessage?: string;
}

export function CookbookRecipeList({
  recipes,
  cookbookId,
  isOwner,
  emptyMessage,
}: CookbookRecipeListProps) {
  const router = useRouter();
  const removeRecipeMutation = useRemoveRecipeFromCookbook();
  const [sortBy, setSortBy] = useState<'custom' | 'recent'>('custom');

  const sortedRecipes = useMemo(() => {
    const copy = [...recipes];
    if (sortBy === 'recent') {
      return copy.sort(
        (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      );
    }
    return copy.sort((a, b) => a.displayOrder - b.displayOrder);
  }, [recipes, sortBy]);

  const formatMinutesShort = (minutes?: number) => {
    if (minutes === undefined || minutes === null) return '';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0 && remainingMinutes > 0) {
      return `${i18n.t('recipes.common.time.hoursShort', { count: hours })} ${i18n.t(
        'recipes.common.time.minutesShort',
        { count: remainingMinutes }
      )}`;
    }
    if (hours > 0) {
      return i18n.t('recipes.common.time.hoursShort', { count: hours });
    }
    return i18n.t('recipes.common.time.minutesShort', { count: remainingMinutes });
  };

  const getDifficultyLabel = (difficulty?: string) => {
    if (!difficulty) return '';
    if (['easy', 'medium', 'hard'].includes(difficulty)) {
      return i18n.t(`recipes.common.difficulty.${difficulty}`);
    }
    return difficulty;
  };

  const handleRecipePress = async (recipeId: string) => {
    await Haptics.selectionAsync();
    router.push(`/(tabs)/recipes/${recipeId}`);
  };

  const handleRemoveRecipe = (recipeId: string, recipeName: string) => {
    Alert.alert(
      i18n.t('cookbooks.removeRecipe'),
      i18n.t('cookbooks.removeRecipeConfirm', { name: recipeName }),
      [
        {
          text: i18n.t('common.cancel'),
          style: 'cancel',
        },
        {
          text: i18n.t('common.remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeRecipeMutation.mutateAsync({
                cookbookId,
                recipeId,
              });
            } catch (error) {
              const err = error as Error;
              Alert.alert(
                i18n.t('common.errors.title'),
                err.message || i18n.t('cookbooks.errors.removeRecipeFailed')
              );
            }
          },
        },
      ]
    );
  };

  const renderRecipeItem = ({ item }: { item: CookbookRecipe }) => (
    <Pressable
      onPress={() => handleRecipePress(item.id)}
      className="bg-white rounded-md shadow-sm mb-md mx-md active:opacity-70"
    >
      <View className="flex-row p-md">
        {/* Recipe Image */}
        <View className="w-24 h-24 rounded-md overflow-hidden mr-md">
          <RecipeImage
            pictureUrl={item.imageUrl}
            className="w-full h-full"
            width={96}
            height={96}
          />
        </View>

        {/* Recipe Info */}
        <View className="flex-1 justify-between">
          <View>
            <Text preset="subheading" numberOfLines={2} className="mb-xs">
              {item.name}
            </Text>

            {item.description && (
              <Text
                preset="caption"
                className="text-text-secondary"
                numberOfLines={2}
              >
                {item.description}
              </Text>
            )}
          </View>

          {/* Metadata */}
          <View className="flex-row items-center gap-md">
            {item.prepTimeMinutes && (
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={14} color="#666" />
                <Text preset="caption" className="text-text-secondary ml-xs">
                  {formatMinutesShort(item.prepTimeMinutes)}
                </Text>
              </View>
            )}

            {item.difficulty && (
              <View className="flex-row items-center">
                <Ionicons name="bar-chart-outline" size={14} color="#666" />
                <Text preset="caption" className="text-text-secondary ml-xs">
                  {getDifficultyLabel(item.difficulty)}
                </Text>
              </View>
            )}

            {item.servings && (
              <View className="flex-row items-center">
                <Ionicons name="people-outline" size={14} color="#666" />
                <Text preset="caption" className="text-text-secondary ml-xs">
                  {item.servings} {i18n.t('recipes.common.portions')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Remove button (only for owner) */}
        {isOwner && (
          <Pressable
            onPress={() => handleRemoveRecipe(item.id, item.name)}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('cookbooks.a11y.removeFromCookbook')}
            className="p-xs ml-sm"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={24} color="#D83A3A" />
          </Pressable>
        )}
      </View>

      {/* Personal Notes */}
      {item.notes && (
        <View className="bg-primary-lightest/50 px-md py-sm border-t border-neutral-100">
          <Text preset="caption" className="text-text-secondary italic">
            <Ionicons name="document-text-outline" size={12} color="#666" /> {item.notes}
          </Text>
        </View>
      )}
    </Pressable>
  );

  const renderEmpty = () => (
    <View className="flex-1 items-center justify-center p-xl mt-xl">
      <Ionicons name="restaurant-outline" size={64} color="#ccc" />
      <Text preset="h2" className="text-text-secondary mt-md text-center">
        {emptyMessage || i18n.t('cookbooks.noRecipesYet')}
      </Text>
      <Text preset="body" className="text-text-secondary mt-sm text-center">
        {i18n.t('cookbooks.noRecipesDescription')}
      </Text>
    </View>
  );

  if (recipes.length === 0) {
    return renderEmpty();
  }

  return (
    <FlashList
      data={sortedRecipes}
      renderItem={renderRecipeItem}
      keyExtractor={(item) => item.cookbookRecipeId}
      estimatedItemSize={140}
      contentContainerStyle={{ paddingVertical: 16 }}
      ListHeaderComponent={
        recipes.length > 1 ? (
          <View className="px-md pb-sm">
            <Text preset="caption" className="text-text-secondary mb-xs">
              {i18n.t('cookbooks.sort.label')}
            </Text>
            <View className="flex-row gap-sm">
              {[
                { value: 'custom', label: i18n.t('cookbooks.sort.customOrder') },
                { value: 'recent', label: i18n.t('cookbooks.sort.recent') },
              ].map((option) => {
                const isActive = sortBy === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setSortBy(option.value as 'custom' | 'recent')}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    className={`px-sm py-xxs rounded-full border ${
                      isActive
                        ? 'bg-primary-medium/30 border-primary-medium'
                        : 'bg-white border-neutral-200'
                    }`}
                  >
                    <Text
                      preset="caption"
                      className={isActive ? 'text-text-default' : 'text-text-secondary'}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null
      }
      showsVerticalScrollIndicator={false}
    />
  );
}
