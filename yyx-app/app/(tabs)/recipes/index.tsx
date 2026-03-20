import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Animated, FlatList, View, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';
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

  // Collapsible header: "scroll up to reveal" behavior
  // Uses JS-driven scroll tracking instead of Animated.diffClamp (which crashes
  // when recreated) to detect scroll direction and animate the header.
  const [headerHeight, setHeaderHeight] = useState(180);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const accumulatedDelta = useRef(0);
  const isHeaderVisible = useRef(true);
  const activeAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const animateHeader = useCallback((show: boolean) => {
    // Don't re-trigger if already in the target state
    if (isHeaderVisible.current === show) return;
    isHeaderVisible.current = show;

    activeAnimRef.current?.stop();
    const anim = Animated.spring(headerTranslateY, {
      toValue: show ? 0 : -headerHeight,
      useNativeDriver: true,
      stiffness: 200,
      damping: 25,
      mass: 0.8,
    });
    activeAnimRef.current = anim;
    anim.start(() => { activeAnimRef.current = null; });
  }, [headerTranslateY, headerHeight]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const delta = currentY - lastScrollY.current;
    lastScrollY.current = currentY;

    // At the top of the list, always show the header
    if (currentY <= 0) {
      accumulatedDelta.current = 0;
      animateHeader(true);
      return;
    }

    // Accumulate scroll delta in the current direction
    if ((delta > 0 && accumulatedDelta.current < 0) || (delta < 0 && accumulatedDelta.current > 0)) {
      accumulatedDelta.current = 0; // Direction changed, reset
    }
    accumulatedDelta.current += delta;

    // Require a minimum scroll distance before committing to hide/show
    const threshold = 20;

    if (accumulatedDelta.current > threshold) {
      animateHeader(false);
      accumulatedDelta.current = 0;
    } else if (accumulatedDelta.current < -threshold) {
      animateHeader(true);
      accumulatedDelta.current = 0;
    }
  }, [animateHeader]);

  // J3: Scroll-to-top on tab re-press
  const listRef = useRef<FlatList>(null);
  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', (e: { preventDefault: () => void }) => {
      if (navigation.isFocused()) {
        e.preventDefault();
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
        // Show header if it was hidden
        animateHeader(true);
      }
    });
    return unsubscribe;
  }, [navigation, animateHeader]);

  const displayName = userProfile?.name || '';

  // Keep search bar visible whenever search is active.
  const isSearching = searchQuery.trim().length > 0;
  const animatedTranslateY = isSearching ? 0 : headerTranslateY;

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
          transform: [{ translateY: animatedTranslateY }],
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
            ref={listRef}
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
