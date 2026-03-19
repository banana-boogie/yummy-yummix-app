import React, { useMemo, useState, useCallback } from 'react';
import { View, Pressable, Alert, FlatList, RefreshControl } from 'react-native';
import { Text, Button } from '@/components/common';
import { TextInput } from '@/components/form';
import { Ionicons } from '@expo/vector-icons';
import { CookbookRecipe } from '@/types/cookbook.types';
import { RecipeImage } from '@/components/recipe/RecipeImage';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useRemoveRecipeFromCookbook } from '@/hooks/useCookbookQuery';
import { formatTimeInHoursAndMinutes, getDifficultyLabel } from '@/utils/formatters';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

const listContentStyle = { paddingVertical: 16 } as const;

interface RecipeItemProps {
  item: CookbookRecipe;
  isOwner: boolean;
  onPress: (recipeId: string) => void;
  onRemove: (recipeId: string, recipeName: string) => void;
}

const RecipeItem = React.memo(function RecipeItem({
  item,
  isOwner,
  onPress,
  onRemove,
}: RecipeItemProps) {
  return (
    <Pressable
      onPress={() => onPress(item.id)}
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
                <Ionicons name="time-outline" size={14} color={COLORS.text.secondary} />
                <Text preset="caption" className="text-text-secondary ml-xs">
                  {formatTimeInHoursAndMinutes(item.prepTimeMinutes ?? null)}
                </Text>
              </View>
            )}

            {item.difficulty && (
              <View className="flex-row items-center">
                <Ionicons name="bar-chart-outline" size={14} color={COLORS.text.secondary} />
                <Text preset="caption" className="text-text-secondary ml-xs">
                  {getDifficultyLabel(item.difficulty, i18n)}
                </Text>
              </View>
            )}

            {item.servings && (
              <View className="flex-row items-center">
                <Ionicons name="people-outline" size={14} color={COLORS.text.secondary} />
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
            onPress={() => onRemove(item.id, item.name)}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('cookbooks.a11y.removeFromCookbook')}
            className="p-xs ml-sm"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={24} color={COLORS.primary.darkest} />
          </Pressable>
        )}
      </View>

      {/* Personal Notes */}
      {item.notes && (
        <View className="bg-primary-lightest/50 px-md py-sm border-t border-neutral-100">
          <Text preset="caption" className="text-text-secondary italic">
            <Ionicons name="document-text-outline" size={12} color={COLORS.text.secondary} /> {item.notes}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

interface CookbookRecipeListProps {
  recipes: CookbookRecipe[];
  cookbookId: string;
  isOwner: boolean;
  emptyMessage?: string;
  onRefresh?: () => Promise<unknown>;
  onRecipeRemoved?: () => void;
}

export function CookbookRecipeList({
  recipes,
  cookbookId,
  isOwner,
  emptyMessage,
  onRefresh,
  onRecipeRemoved,
}: CookbookRecipeListProps) {
  const router = useRouter();
  const removeRecipeMutation = useRemoveRecipeFromCookbook();
  const [sortBy, setSortBy] = useState<'custom' | 'recent'>('custom');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const sortedRecipes = useMemo(() => {
    const copy = [...recipes];
    if (sortBy === 'recent') {
      return copy.sort(
        (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      );
    }
    return copy.sort((a, b) => a.displayOrder - b.displayOrder);
  }, [recipes, sortBy]);

  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) return sortedRecipes;
    const query = searchQuery.toLowerCase();
    return sortedRecipes.filter(r => r.name.toLowerCase().includes(query));
  }, [sortedRecipes, searchQuery]);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const handleRecipePress = React.useCallback(async (recipeId: string) => {
    await Haptics.selectionAsync();
    router.push(`/(tabs)/recipes/${recipeId}`);
  }, [router]);

  const handleRemoveRecipe = React.useCallback((recipeId: string, recipeName: string) => {
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
              onRecipeRemoved?.();
            } catch (_error) {
              Alert.alert(
                i18n.t('common.errors.title'),
                i18n.t('cookbooks.errors.removeRecipeFailed')
              );
            }
          },
        },
      ]
    );
  }, [cookbookId, removeRecipeMutation, onRecipeRemoved]);

  const renderRecipeItem = React.useCallback(
    ({ item }: { item: CookbookRecipe }) => (
      <RecipeItem
        item={item}
        isOwner={isOwner}
        onPress={handleRecipePress}
        onRemove={handleRemoveRecipe}
      />
    ),
    [isOwner, handleRecipePress, handleRemoveRecipe]
  );

  const renderEmpty = () => (
    <View className="flex-1 items-center justify-center p-xl mt-xl">
      <Ionicons name="restaurant-outline" size={64} color={COLORS.grey.medium} />
      <Text preset="h2" className="text-text-secondary mt-md text-center">
        {emptyMessage || i18n.t('cookbooks.noRecipesYet')}
      </Text>
      <Text preset="body" className="text-text-secondary mt-sm text-center">
        {i18n.t('cookbooks.noRecipesDescription')}
      </Text>
      <View className="mt-lg">
        <Button
          variant="primary"
          onPress={() => router.push('/(tabs)/recipes')}
        >
          {i18n.t('cookbooks.browseRecipes')}
        </Button>
      </View>
    </View>
  );

  if (recipes.length === 0) {
    return renderEmpty();
  }

  const listHeader = (
    <View className="px-md pb-sm">
      {/* Search bar */}
      <View className="mb-sm">
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={i18n.t('cookbooks.searchRecipes')}
          leftIcon={
            <Ionicons name="search" size={18} color={COLORS.text.secondary} />
          }
          containerClassName="mb-0"
        />
      </View>

      {/* Sort controls */}
      {recipes.length > 1 && (
        <View>
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
      )}
    </View>
  );

  return (
    <FlatList
      data={filteredRecipes}
      renderItem={renderRecipeItem}
      keyExtractor={(item) => item.cookbookRecipeId}
      contentContainerStyle={listContentStyle}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        searchQuery.trim() ? (
          <View className="items-center justify-center p-xl">
            <Ionicons name="search-outline" size={48} color={COLORS.grey.medium} />
            <Text preset="body" className="text-text-secondary mt-md text-center">
              {i18n.t('recipes.common.noRecipesFound')}
            </Text>
          </View>
        ) : null
      }
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary.medium}
            colors={[COLORS.primary.medium]}
          />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
    />
  );
}
