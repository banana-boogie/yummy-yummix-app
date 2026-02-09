import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Animated, View, Platform, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useRecipes } from '@/hooks/useRecipes';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { SPACING } from '@/constants/design-tokens';

import { RecipeListHeader } from '@/components/recipe/RecipeListHeader';
import { SearchBar } from '@/components/common/SearchBar';
import { RecipeList } from '@/components/recipe/RecipeList';
import { PageLayout } from '@/components/layouts/PageLayout';
import i18n from '@/i18n';
import { eventService } from '@/services/eventService';

// Main component
const Recipes = () => {
  // State
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Hooks
  const {
    recipes,
    loading,
    initialLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    setSearch
  } = useRecipes();

  const { userProfile } = useUserProfile();

  // Track the last logged search to avoid duplicate logs
  const lastLoggedSearch = useRef<string>('');

  // Handler for search changes - now the debounce happens inside the SearchBar
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    setSearch(text);
  }, [setSearch]);

  // Log search events after debounce (when searchQuery changes from SearchBar)
  useEffect(() => {
    // Only log if we have a non-empty query that's different from the last logged one
    if (searchQuery && searchQuery.trim().length > 0 && searchQuery !== lastLoggedSearch.current) {
      lastLoggedSearch.current = searchQuery;
      eventService.logSearch(searchQuery);
    }
  }, [searchQuery]);

  // Collapsible header logic
  const [headerHeight, setHeaderHeight] = useState(180);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Fix: Clamp scrollY to 0 to prevent header interaction with iOS bounce (overscroll)
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

  const handleLogoPress = () => {
    router.push('/(tabs)/profile');
  };

  // Ensure we have a name to display
  const displayName = userProfile?.name || '';

  return (
    <PageLayout contentPaddingHorizontal={0} disableMaxWidth={true}>
      <Animated.View
        style={{
          transform: [{ translateY }],
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
          onLogoPress={handleLogoPress}
        />
        <View className="pb-sm px-md bg-background-default w-full max-w-[1200px] self-center">
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={handleSearchChange}
            placeholder={i18n.t('recipes.common.search')}
            useDebounce={true}
            debounceDelay={300}
          />
        </View>
      </Animated.View>

      <View className="flex-1 w-full max-w-[1200px] self-center">
        <RecipeList
          recipes={recipes}
          loading={loading}
          initialLoading={initialLoading}
          error={error}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          contentContainerStyle={{ paddingTop: headerHeight, paddingHorizontal: SPACING.md }}
        />
      </View>
    </PageLayout>
  );
};

export default Recipes;
