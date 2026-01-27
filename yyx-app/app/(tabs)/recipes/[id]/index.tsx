import { View, Platform, StatusBar, Animated, Pressable } from 'react-native';
import React, { useRef, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';

import { Text } from '@/components/common/Text';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { useRecipe } from '@/hooks/useRecipe';
import i18n from '@/i18n';
import { isValidUUID } from '@/utils/validation';
import { eventService } from '@/services/eventService';

import { RecipeInfo } from '@/components/recipe-detail/RecipeInfo';
import { CookButton } from '@/components/recipe-detail/CookButton';
import { RecipeIngredients } from '@/components/recipe-detail/RecipeIngredients';
import { RecipeUsefulItems } from '@/components/recipe-detail/RecipeUsefulItems';
import { RecipeSteps } from '@/components/recipe-detail/RecipeSteps';
import { RecipeTip } from '@/components/recipe-detail/RecipeTip';
import { RecipeImageHeader } from '@/components/recipe-detail/RecipeDetailHeader';

import { PageLayout } from '@/components/layouts/PageLayout';
import { useDevice } from '@/hooks/useDevice';
import { ResponsiveColumnLayout, MainColumn, SideColumn } from '@/components/layouts/ResponsiveColumnLayout';
import { RecipeUsefulItem } from '@/types/recipe.types';
import { ShareButton } from '@/components/common/ShareButton';
import { useLanguage } from '@/contexts/LanguageContext';
import { AddToCookbookSheet } from '@/components/cookbook';
import { VoiceAssistantButton } from '@/components/common/VoiceAssistantButton';
import { Ionicons } from '@expo/vector-icons';
import { useCookbooksContainingRecipe } from '@/hooks/useCookbookQuery';
import { useAuth } from '@/contexts/AuthContext';

const RecipeDetail: React.FC = () => {
  const { id, from } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [showCookbookSheet, setShowCookbookSheet] = useState(false);

  // Validate ID early to prevent unnecessary API calls
  useEffect(() => {
    if (id && !isValidUUID(id as string)) {
      console.warn(`Invalid recipe ID format: ${id}, redirecting to recipes page`);
      // Using replace instead of push to avoid adding to history stack
      router.replace('/(tabs)/recipes');
    }
  }, [id, router]);

  // Only proceed with recipe fetch if we have a valid UUID
  const validId = id && isValidUUID(id as string) ? (id as string) : '';
  const { recipe, loading, error } = useRecipe(validId);
  const {
    data: cookbooksContaining = [],
    isLoading: loadingCookbooks,
  } = useCookbooksContainingRecipe(validId);

  // Track recipe view when recipe loads successfully
  useEffect(() => {
    if (recipe?.id && recipe?.name) {
      eventService.logRecipeView(recipe.id, recipe.name);
    }
  }, [recipe?.id, recipe?.name]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const { isMedium } = useDevice();
  const { language: currentLanguage } = useLanguage();

  // Handle back navigation for web and native
  const handleBackPress = () => {
    // If we came from chat, navigate back to chat explicitly
    if (from === 'chat') {
      // Use navigate to switch to the chat tab properly
      router.navigate('/(tabs)/chat');
      return;
    }

    if (Platform.OS === 'web') {
      // Use history API directly for web
      window.history.back();
    } else {
      // Use router for native
      router.back();
    }
  };

  // Setup scroll listener
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  const getShareUrl = () => {
    if (!recipe) return '';
    const baseUrl = Platform.OS === 'web' ? window.location.origin : 'https://app.yummyyummix.com';

    return `${baseUrl}/api/recipe-preview/${recipe.id}?lang=${currentLanguage}`;
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!recipe) return null;

  return (
    <>
      {recipe && (
        <Head>
          <title>YummyYummix - {recipe.name}</title>
        </Head>
      )}

      <StatusBar barStyle="dark-content" />

      <View style={{ flex: 1 }}>
        <PageLayout contentPaddingHorizontal={0} disableMaxWidth={true}>
          <Animated.ScrollView
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={true}
            bounces={true}
          >
            {/* Recipe image header - constrained to same max-width as content for alignment */}
            <View className="w-full max-w-[500px] md:max-w-[700px] lg:max-w-[900px] self-center">
              <RecipeImageHeader pictureUrl={recipe.pictureUrl} onBackPress={handleBackPress} className="mb-md" />
            </View>

            {/* Container for the content to limit width on large screens */}
            <View className="w-full max-w-[500px] md:max-w-[700px] lg:max-w-[900px] self-center px-md">
              {/* Title and Info Section */}
              <Text preset="h1" className="mb-xs">
                {recipe.name}
              </Text>

              <RecipeInfo
                totalTime={recipe.totalTime}
                prepTime={recipe.prepTime}
                difficulty={recipe.difficulty}
                portions={recipe.portions}
                className="mb-md"
              />

              {user && loadingCookbooks && (
                <View className="flex-row flex-wrap gap-xs mb-lg">
                  <Ionicons name="book" size={16} color="#666" style={{ marginTop: 4 }} />
                  <View className="bg-neutral-200 rounded-full h-6 w-20 animate-pulse" />
                  <View className="bg-neutral-200 rounded-full h-6 w-24 animate-pulse" />
                </View>
              )}
              {user && !loadingCookbooks && cookbooksContaining.length > 0 && (
                <View className="flex-row flex-wrap gap-xs mb-lg">
                  <Ionicons name="book" size={16} color="#666" style={{ marginTop: 4 }} />
                  {cookbooksContaining.map((cookbook) => (
                    <Pressable
                      key={cookbook.id}
                      onPress={() => router.push(`/(tabs)/cookbooks/${cookbook.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={i18n.t('cookbooks.a11y.viewCookbook', {
                        name: cookbook.name,
                      })}
                      className="bg-primary-default/30 rounded-full px-sm py-xxs active:opacity-70"
                    >
                      <Text preset="caption" className="text-text-default">
                        {cookbook.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <View className="mb-xs flex-row justify-between items-center">
                <CookButton recipeId={recipe.id} size="large" className="mb-lg" />
                <View className="mb-lg flex-row gap-sm">
                  <Pressable
                    onPress={() => setShowCookbookSheet(true)}
                    className="bg-primary-medium rounded-full p-sm active:opacity-70"
                  >
                    <Ionicons name="book-outline" size={24} color="#2D2D2D" />
                  </Pressable>
                  <ShareButton
                    message={i18n.t('recipes.share.message', { recipeName: recipe.name })}
                    url={getShareUrl()}
                  />
                </View>
              </View>

              {/* Content Section */}
              <ResponsiveColumnLayout>
                <SideColumn className={`pr-md ${isMedium ? 'flex-[1.3]' : 'flex-1'}`}>
                  <RecipeIngredients ingredients={recipe.ingredients} className="mb-xxl" />
                  <RecipeUsefulItems usefulItems={recipe.usefulItems as RecipeUsefulItem[]} className="mb-xxl" />
                </SideColumn>

                <MainColumn className="pl-md border-l border-border-default">
                  <RecipeSteps steps={recipe.steps} className="mb-xxl" />

                  <RecipeTip text={recipe.tipsAndTricks} />
                </MainColumn>
              </ResponsiveColumnLayout>
              <CookButton recipeId={recipe.id} size="large" className="my-xxl" />
            </View>
          </Animated.ScrollView>
        </PageLayout>

        <AddToCookbookSheet
          visible={showCookbookSheet}
          onClose={() => setShowCookbookSheet(false)}
          recipeId={recipe.id}
          recipeName={recipe.name}
          onSuccess={() => {
            console.log('Recipe added to cookbook');
          }}
        />

        <VoiceAssistantButton
          recipeContext={{
            type: 'recipe',
            recipeId: recipe.id,
            recipeTitle: recipe.name,
            ingredients: recipe.ingredients?.map((ing) => ({
              name: ing.name,
              amount: `${ing.formattedQuantity} ${ing.formattedUnit}`,
            })),
          }}
        />
      </View>
    </>
  );
};

export default RecipeDetail;
