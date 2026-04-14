import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Animated, FlatList, View, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRecipes } from '@/hooks/useRecipes';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useMealPlan } from '@/hooks/useMealPlan';
import { usePersonalizedSections } from '@/hooks/usePersonalizedSections';
import {
  usePersonalizedFilterChips,
  applyChipToSections,
} from '@/hooks/usePersonalizedFilterChips';
import { SPACING } from '@/constants/design-tokens';
import { filterByDietarySafety } from '@/utils/dietarySafety';

import { RecipeListHeader } from '@/components/recipe/RecipeListHeader';
import { SearchBar } from '@/components/common/SearchBar';
import { RecipeSectionList, RecipeSection } from '@/components/recipe/RecipeSectionList';
import { RecipeList } from '@/components/recipe/RecipeList';
import { FilterChips } from '@/components/recipe/FilterChips';
import { ExploreRecipeCard } from '@/components/recipe/ExploreRecipeCard';
import { AddToPlanModal } from '@/components/recipe/AddToPlanModal';
import { PageLayout } from '@/components/layouts/PageLayout';
import i18n from '@/i18n';
import { eventService } from '@/services/eventService';
import type { Recipe } from '@/types/recipe.types';

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
  const { plan: activePlan } = useMealPlan();

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

  // Scroll-to-top on tab re-press (manual listener — useScrollToTop doesn't
  // work reliably with Expo Router's file-based routing + custom tab bar)
  const listRef = useRef<FlatList>(null);
  const navigation = useNavigation();
  const parentNavigation = navigation.getParent();
  useEffect(() => {
    if (!parentNavigation) return;
    const unsubscribe = parentNavigation.addListener('tabPress', () => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      animateHeader(true);
    });
    return unsubscribe;
  }, [parentNavigation, animateHeader]);

  const displayName = userProfile?.name || '';

  // Keep search bar visible whenever search is active.
  const isSearching = searchQuery.trim().length > 0;
  const animatedTranslateY = isSearching ? 0 : headerTranslateY;

  // Build personalized recipe sections (restriction-filtered by default)
  const sections = usePersonalizedSections({
    recipes,
    userProfile,
    activePlan,
  });

  // Filter chips — single-select, additive on top of dietary restrictions.
  const chips = usePersonalizedFilterChips(recipes, userProfile);
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);
  const selectedChip = useMemo(
    () => chips.find((c) => c.id === selectedChipId) ?? null,
    [chips, selectedChipId],
  );

  // Add to Plan modal
  const [planRecipe, setPlanRecipe] = useState<Recipe | null>(null);
  const handleAddToPlan = useCallback((recipe: Recipe) => {
    setPlanRecipe(recipe);
  }, []);
  const renderExploreCard = useCallback(
    (recipe: Recipe, compact: boolean) => (
      <ExploreRecipeCard recipe={recipe} compact={compact} onAddToPlan={handleAddToPlan} />
    ),
    [handleAddToPlan],
  );
  // Adapter for RecipeList (flat grid, non-compact) — keeps Add-to-Plan parity
  // between the sectioned feed and the search results list.
  const renderExploreCardForList = useCallback(
    (recipe: Recipe) => (
      <ExploreRecipeCard recipe={recipe} compact={false} onAddToPlan={handleAddToPlan} />
    ),
    [handleAddToPlan],
  );

  // Apply the same dietary-safety filter to the search-mode list as the
  // sectioned feed does, so a shellfish-allergic user never sees shrimp in
  // search results either.
  const safeSearchRecipes = useMemo(
    () => filterByDietarySafety(recipes, userProfile),
    [recipes, userProfile],
  );

  const handleSectionViewed = useCallback(
    (section: RecipeSection, position: number) => {
      eventService.logExploreSectionViewed({
        sectionId: section.id,
        sectionPosition: position,
        recipeCount: section.recipes.length,
      });
    },
    [],
  );

  const handleChipSelect = useCallback(
    (id: string | null) => {
      setSelectedChipId(id);
      if (id) {
        const chip = chips.find((c) => c.id === id);
        eventService.logExploreFilterApplied({
          filterId: id,
          filterType: chip?.filter.cuisine
            ? 'cuisine'
            : chip?.filter.dietType
            ? 'diet'
            : chip?.filter.maxTime
            ? 'time'
            : 'other',
        });
      }
    },
    [chips],
  );

  // When a chip is active, narrow only the "all_recipes" section's recipes.
  // If the filter empties that section, drop it entirely so we don't render
  // a lonely header with nothing under it.
  const displaySections = useMemo<RecipeSection[]>(
    () => applyChipToSections(sections, selectedChip),
    [sections, selectedChip],
  );

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
        <View className="pb-sm px-md bg-background-default w-full max-w-[1200px] self-center">
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={handleSearchChange}
            placeholder={i18n.t('recipes.header.subtitle')}
            useDebounce={false}
            variant="warm"
          />
        </View>
        {!isSearching && chips.length > 0 && (
          <View className="pb-sm bg-background-default w-full max-w-[1200px] self-center">
            <FilterChips
              chips={chips}
              selectedId={selectedChipId}
              onSelect={handleChipSelect}
            />
          </View>
        )}
      </Animated.View>

      <View className="flex-1 w-full max-w-[1200px] self-center">
        {isSearching ? (
          /* When searching, fall back to flat grid list */
          <RecipeList
            recipes={safeSearchRecipes}
            loading={loading}
            initialLoading={initialLoading}
            error={error}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onScroll={onScroll}
            contentContainerStyle={{ paddingTop: headerHeight, paddingHorizontal: SPACING.md }}
            renderCard={renderExploreCardForList}
          />
        ) : (
          /* Default: sectioned feed */
          <RecipeSectionList
            ref={listRef}
            sections={displaySections}
            loading={loading}
            initialLoading={initialLoading}
            error={error}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onScroll={onScroll}
            contentContainerStyle={{ paddingTop: headerHeight }}
            renderCard={renderExploreCard}
            onSectionViewed={handleSectionViewed}
          />
        )}
      </View>
      <AddToPlanModal
        visible={!!planRecipe}
        recipe={planRecipe}
        onClose={() => setPlanRecipe(null)}
        activePlan={activePlan}
      />
    </PageLayout>
  );
};

export default Recipes;
