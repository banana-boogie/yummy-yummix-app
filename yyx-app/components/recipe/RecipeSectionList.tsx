import React, { useMemo, useCallback } from 'react';
import {
  View,
  Animated,
  ScrollView,
  StyleProp,
  ViewStyle,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
} from 'react-native';

import { WatercolorRecipeCard } from '@/components/recipe/WatercolorRecipeCard';
import { Text } from '@/components/common/Text';
import { COLORS, SPACING, FONT_SIZES } from '@/constants/design-tokens';
import i18n from '@/i18n';
import { Recipe } from '@/types/recipe.types';
import { useDevice } from '@/hooks/useDevice';

export interface RecipeSection {
  id: string;
  title: string;
  subtitle?: string;
  recipes: Recipe[];
  layout: 'horizontal' | 'grid';
}

interface RecipeSectionListProps {
  sections: RecipeSection[];
  onLoadMore: () => void;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  loading: boolean;
  initialLoading: boolean;
  error: string | null;
  hasMore: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

// Memoized horizontal section
const HorizontalSection = React.memo(function HorizontalSection({ recipes }: { recipes: Recipe[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: SPACING.sm, gap: SPACING.xl }}
      removeClippedSubviews
    >
      {recipes.map(recipe => (
        <WatercolorRecipeCard key={recipe.id} recipe={recipe} compact />
      ))}
    </ScrollView>
  );
});

// Memoized grid item
const GridItem = React.memo(function GridItem({
  recipe,
  itemWidth,
}: {
  recipe: Recipe;
  itemWidth: number | string;
}) {
  return (
    <View style={{ width: itemWidth, marginBottom: SPACING.xl }}>
      <WatercolorRecipeCard recipe={recipe} />
    </View>
  );
});

export const RecipeSectionList: React.FC<RecipeSectionListProps> = ({
  sections,
  onLoadMore,
  onScroll,
  loading,
  initialLoading,
  error,
  hasMore,
  contentContainerStyle,
}) => {
  const { isPhone } = useDevice();
  const { width: screenWidth } = useWindowDimensions();

  // Grid layout calculations
  const numColumns = isPhone ? 1 : 2;
  const containerPadding = SPACING.md * 2;
  const gap = SPACING.md;
  const availableWidth = Math.min(screenWidth, 1200) - containerPadding;
  const gridItemWidth = numColumns === 1 ? '100%' : (availableWidth - gap) / 2;

  // Build flat list data with section index for alternating backgrounds
  const flatData = useMemo(() => {
    const items: {
      key: string;
      type: 'section-block' | 'grid-row';
      section?: RecipeSection;
      sectionIndex?: number;
      recipes?: Recipe[];
    }[] = [];

    sections.forEach((section, sectionIndex) => {
      if (section.layout === 'horizontal') {
        // Horizontal sections render as a single block (header + scroll)
        items.push({
          key: `block-${section.id}`,
          type: 'section-block',
          section,
          sectionIndex,
        });
      } else {
        // Grid section: header first, then rows
        items.push({
          key: `block-${section.id}`,
          type: 'section-block',
          section,
          sectionIndex,
        });

        const recipes = section.recipes;
        for (let i = 0; i < recipes.length; i += numColumns) {
          const rowRecipes = recipes.slice(i, i + numColumns);
          items.push({
            key: `grid-${section.id}-${i}`,
            type: 'grid-row',
            recipes: rowRecipes,
            sectionIndex,
          });
        }
      }
    });

    return items;
  }, [sections, numColumns]);

  const renderItem = useCallback(({ item }: { item: typeof flatData[0] }) => {
    switch (item.type) {
      case 'section-block': {
        const section = item.section!;
        const isGrid = section.layout === 'grid';

        if (isGrid) {
          // Divider before All Recipes grid
          return (
            <View>
              <View
                className="mx-lg mt-md mb-sm"
                style={{ height: 1, backgroundColor: COLORS.grey.default }}
              />
              <View className="px-md pt-sm pb-sm">
                <Text
                  preset="h2"
                  className="text-text-default"
                  marginBottom={0}
                >
                  {section.title}
                </Text>
              </View>
            </View>
          );
        }

        // Horizontal section: wrapped in a subtle card container
        return (
          <View className="mx-md mb-xxl">
            <View
              className="rounded-lg overflow-hidden"
              style={{
                borderWidth: 1,
                borderColor: COLORS.grey.default,
              }}
            >
              {/* Section header */}
              <View className="px-md pt-md pb-sm">
                <Text
                  preset="subheading"
                  className="text-text-default"
                  marginBottom={0}
                  style={{ fontSize: FONT_SIZES.xl }}
                >
                  {section.title}
                </Text>
                {section.subtitle && (
                  <Text preset="bodySmall" className="text-text-secondary mt-xxs">
                    {section.subtitle}
                  </Text>
                )}
              </View>

              {/* Horizontal scroll content */}
              <View className="pb-md">
                <HorizontalSection recipes={section.recipes} />
              </View>
            </View>
          </View>
        );
      }

      case 'grid-row': {
        return (
          <View className="px-md">
            <View
              style={{
                flexDirection: 'row',
                justifyContent: numColumns > 1 ? 'space-between' : 'flex-start',
              }}
            >
              {item.recipes!.map(recipe => (
                <GridItem
                  key={recipe.id}
                  recipe={recipe}
                  itemWidth={gridItemWidth}
                />
              ))}
              {numColumns > 1 && item.recipes!.length < numColumns && (
                <View style={{ width: gridItemWidth }} />
              )}
            </View>
          </View>
        );
      }

      default:
        return null;
    }
  }, [numColumns, gridItemWidth]);

  const keyExtractor = useCallback(
    (item: typeof flatData[0]) => item.key,
    []
  );

  // Empty/loading/error states
  const renderEmptyList = useMemo(() => {
    if (initialLoading) {
      return (
        <View className="items-center justify-center pt-[96px]">
          <ActivityIndicator size="large" color={COLORS.primary.default} />
          <Text className="text-center mt-xl text-lg text-text-secondary">
            {i18n.t('recipes.common.loading')}
          </Text>
        </View>
      );
    }
    if (error) {
      return (
        <Text className="text-center mt-xl text-lg text-text-secondary">
          {i18n.t('recipes.common.error')}
        </Text>
      );
    }
    return (
      <Text className="text-center mt-xl text-lg text-text-secondary">
        {i18n.t('recipes.common.noRecipesFound')}
      </Text>
    );
  }, [initialLoading, error]);

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

  return (
    <View className="flex-1">
      <Animated.FlatList
        className="flex-1"
        data={flatData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={flatData.length === 0 ? renderEmptyList : null}
        ListFooterComponent={renderFooter}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator
        onEndReached={hasMore && !loading ? onLoadMore : undefined}
        onEndReachedThreshold={0.5}
        onScroll={onScroll}
        contentContainerStyle={contentContainerStyle}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews={false}
      />
    </View>
  );
};
