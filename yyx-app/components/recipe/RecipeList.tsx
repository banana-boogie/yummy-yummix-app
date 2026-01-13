// screens/RecipeList.tsx
import React, { useMemo, useCallback } from 'react';
import { View, Animated, StyleProp, ViewStyle, ActivityIndicator, NativeSyntheticEvent, NativeScrollEvent, useWindowDimensions } from 'react-native';

import { RecipeCard } from '@/components/recipe/RecipeCard';
import { Text } from '@/components/common/Text';
import { COLORS, SPACING } from '@/constants/design-tokens';
import i18n from '@/i18n';
import { Recipe } from '@/types/recipe.types';
import { useDevice } from '@/hooks/useDevice';

interface RecipeListProps {
  recipes: Recipe[];
  loading: boolean;
  initialLoading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

// Memoized item wrapper - defined outside component to prevent recreation
const RecipeItemWrapper = React.memo(({
  item,
  itemWidth
}: {
  item: Recipe;
  itemWidth: number | string;
}) => (
  <View style={{ width: itemWidth, marginBottom: SPACING.xl }}>
    <RecipeCard recipe={item} />
  </View>
));

export const RecipeList: React.FC<RecipeListProps> = ({
  recipes,
  loading,
  initialLoading,
  error,
  hasMore,
  onLoadMore,
  className = '',
  style,
  onScroll,
  contentContainerStyle
}) => {
  const { isPhone } = useDevice();
  const { width: screenWidth } = useWindowDimensions();

  // Determine number of columns based on screen size
  const numColumns = isPhone ? 1 : 2;

  // Calculate item width for grid
  // Account for padding (SPACING.md on each side) and gap between items
  const containerPadding = SPACING.md * 2;
  const gap = SPACING.md;
  const availableWidth = Math.min(screenWidth, 1200) - containerPadding;
  const itemWidth = numColumns === 1
    ? '100%'
    : (availableWidth - gap) / 2;

  // Separate the first item to render it at full width (featured)
  const featuredRecipe = recipes.length > 0 ? recipes[0] : null;
  const remainingRecipes = recipes.length > 1 ? recipes.slice(1) : [];

  // Render empty list component
  const renderEmptyList = useMemo(() => {
    if (initialLoading) {
      return (
        <View className="items-center justify-center pt-[96px]">
          <ActivityIndicator size="large" color={COLORS.primary.default} />
          <Text className="text-center mt-xl text-lg text-text-secondary">{i18n.t('recipes.common.loading')}</Text>
        </View>
      );
    }
    if (error) {
      return <Text className="text-center mt-xl text-lg text-text-secondary">{i18n.t('recipes.common.error')}</Text>;
    }
    return <Text className="text-center mt-xl text-lg text-text-secondary">{i18n.t('recipes.common.noRecipesFound')}</Text>;
  }, [initialLoading, error]);

  // Render footer with loading indicator when loading more
  const renderFooter = useCallback(() => {
    if (!hasMore) return null;

    return (
      <View className="py-md items-center justify-center mb-xl">
        {loading && !initialLoading && (
          <ActivityIndicator size="small" color={COLORS.primary.default} />
        )}
      </View>
    );
  }, [hasMore, loading, initialLoading]);

  // Render each item
  const renderItem = useCallback(({ item }: { item: Recipe }) => (
    <RecipeItemWrapper item={item} itemWidth={itemWidth} />
  ), [itemWidth]);

  // Key extractor
  const keyExtractor = useCallback((item: Recipe) => item.id, []);

  // Header component with featured recipe
  const ListHeader = useMemo(() => {
    if (!featuredRecipe) return null;
    return (
      <View style={{ marginBottom: SPACING.xl }}>
        <RecipeCard recipe={featuredRecipe} featured={!isPhone} />
      </View>
    );
  }, [featuredRecipe, isPhone]);

  return (
    <View className={`flex-1 ${className}`} style={style}>
      <Animated.FlatList
        className="flex-1"
        data={remainingRecipes}
        renderItem={renderItem}
        keyExtractor={keyExtractor}

        // Grid configuration
        numColumns={numColumns}
        key={`recipe-list-${numColumns}`}
        columnWrapperStyle={numColumns > 1 ? { justifyContent: 'space-between' } : undefined}

        // Header (Featured Recipe)
        ListHeaderComponent={ListHeader}

        // Footer & Empty States
        ListEmptyComponent={recipes.length === 0 ? renderEmptyList : null}
        ListFooterComponent={renderFooter}

        // Scroll & Pagination
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
        onEndReached={hasMore && !loading ? onLoadMore : undefined}
        onEndReachedThreshold={0.5}
        onScroll={onScroll}
        contentContainerStyle={contentContainerStyle}

        // Performance optimizations
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews={false}
        getItemLayout={undefined}
      />
    </View>
  );
};

