import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Animated, View } from 'react-native';
import { useRecipes } from '@/hooks/useRecipes';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { SPACING } from '@/constants/design-tokens';

import { RecipeListHeader } from '@/components/recipe/RecipeListHeader';
import { SearchBar } from '@/components/common/SearchBar';
import { RecipeSectionList, RecipeSection } from '@/components/recipe/RecipeSectionList';
import { RecipeList } from '@/components/recipe/RecipeList';
import { PageLayout } from '@/components/layouts/PageLayout';
import i18n from '@/i18n';
import { eventService } from '@/services/eventService';
import { filterQuick, filterFamily, filterRecent } from '@/utils/recipeFilters';

const Recipes = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const {
    recipes,
    loading,
    initialLoading,
    error,
    hasMore,
    loadMore,
    setSearch
  } = useRecipes();

  const { userProfile } = useUserProfile();

  const lastLoggedSearch = useRef<string>('');

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    setSearch(text);
  }, [setSearch]);

  useEffect(() => {
    if (searchQuery && searchQuery.trim().length > 0 && searchQuery !== lastLoggedSearch.current) {
      lastLoggedSearch.current = searchQuery;
      eventService.logSearch(searchQuery);
    }
  }, [searchQuery]);

  // Collapsible header logic
  const [headerHeight, setHeaderHeight] = useState(180);
  const scrollY = useRef(new Animated.Value(0)).current;

  const clampedScrollY = scrollY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolateLeft: 'clamp',
  });

  const diffClamp = Animated.diffClamp(clampedScrollY, 0, headerHeight);

  const translateY = diffClamp.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [0, -headerHeight],
  });

  const displayName = userProfile?.name || '';

  const onScroll = useMemo(
    () => Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: true }
    ),
    [scrollY]
  );

  // Keep search bar visible whenever search is active.
  const isSearching = searchQuery.trim().length > 0;
  const headerTranslateY = isSearching ? 0 : translateY;

  // Build recipe sections for the sectioned feed
  const sections = useMemo((): RecipeSection[] => {
    if (!recipes.length) return [];

    const allSections: RecipeSection[] = [
      {
        id: 'quick',
        title: i18n.t('recipes.sections.quick'),
        recipes: filterQuick(recipes, 30),
        layout: 'horizontal',
      },
      {
        id: 'family',
        title: i18n.t('recipes.sections.family'),
        recipes: filterFamily(recipes, 4),
        layout: 'horizontal',
      },
      {
        id: 'new',
        title: i18n.t('recipes.sections.new'),
        recipes: filterRecent(recipes, 7),
        layout: 'horizontal',
      },
      {
        id: 'all',
        title: i18n.t('recipes.sections.all'),
        recipes: recipes,
        layout: 'grid',
      },
    ];

    // Remove empty sections
    return allSections.filter(section => section.recipes.length > 0);
  }, [recipes]);

  return (
    <PageLayout contentPaddingHorizontal={0} disableMaxWidth={true}>
      <Animated.View
        style={{
          transform: [{ translateY: headerTranslateY }],
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1,
        }}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        className="bg-background-default"
      >
        <RecipeListHeader
          displayName={displayName}
          onLogoPress={() => {}}
        />
        <View className="pb-md px-md bg-background-default w-full max-w-[1200px] self-center">
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={handleSearchChange}
            placeholder={i18n.t('recipes.header.subtitle')}
            useDebounce={false}
            variant="warm"
          />
        </View>
      </Animated.View>

      <View className="flex-1 w-full max-w-[1200px] self-center">
        {isSearching ? (
          /* When searching, fall back to flat grid list */
          <RecipeList
            recipes={recipes}
            loading={loading}
            initialLoading={initialLoading}
            error={error}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onScroll={onScroll}
            contentContainerStyle={{ paddingTop: headerHeight, paddingHorizontal: SPACING.md }}
          />
        ) : (
          /* Default: sectioned feed */
          <RecipeSectionList
            sections={sections}
            loading={loading}
            initialLoading={initialLoading}
            error={error}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onScroll={onScroll}
            contentContainerStyle={{ paddingTop: headerHeight }}
          />
        )}
      </View>
    </PageLayout>
  );
};

export default Recipes;
