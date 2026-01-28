import { View, Platform, StatusBar, Animated } from 'react-native';
import React, { useRef, useEffect } from 'react';
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
import { VoiceAssistantButton } from '@/components/common/VoiceAssistantButton';
import { useLanguage } from '@/contexts/LanguageContext';
import { RatingDistribution, RatingDistributionSkeleton, StarRating, StarRatingInput } from '@/components/rating';
import { useRecipeRating } from '@/hooks/useRecipeRating';

const RecipeDetail: React.FC = () => {
  const { id, from } = useLocalSearchParams();
  const router = useRouter();

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

  // Track recipe view when recipe loads successfully
  useEffect(() => {
    if (recipe?.id && recipe?.name) {
      eventService.logRecipeView(recipe.id, recipe.name);
    }
  }, [recipe?.id, recipe?.name]);

  // Fetch rating distribution and user rating
  const {
    ratingDistribution,
    totalRatings,
    isLoadingDistribution,
    userRating,
    isLoadingRating,
    isLoggedIn,
    submitRating,
    isSubmittingRating,
    ratingError,
  } = useRecipeRating(validId);

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

  const ratingCount = recipe.ratingCount ?? 0;
  const averageRating = recipe.averageRating ?? null;

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
              <RecipeImageHeader
                pictureUrl={recipe.pictureUrl}
                onBackPress={handleBackPress}
                className="mb-md"
              />
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

              {/* Rating Summary + CTA */}
              <View className="mb-lg">
                {ratingCount > 0 && averageRating !== null ? (
                  <StarRating rating={averageRating} count={ratingCount} size="lg" />
                ) : (
                  <Text preset="bodySmall" className="text-text-secondary">
                    {i18n.t('recipes.rating.beFirstToRate')}
                  </Text>
                )}

                {isLoggedIn && (
                  <View className="mt-md">
                    <Text preset="h3" className="mb-xs">
                      {i18n.t('recipes.rating.yourRating')}
                    </Text>
                    <StarRatingInput
                      value={userRating ?? 0}
                      onChange={submitRating}
                      disabled={isSubmittingRating || isLoadingRating}
                      size="md"
                    />
                    <Text preset="caption" className="text-text-secondary mt-xs">
                      {userRating
                        ? i18n.t('recipes.rating.tapToUpdateRating')
                        : i18n.t('recipes.rating.rateThisRecipe')}
                    </Text>
                    {ratingError && (
                      <Text preset="caption" className="text-status-error mt-xs">
                        {i18n.t('recipes.rating.submitError')}
                      </Text>
                    )}
                  </View>
                )}
              </View>

              <View className="mb-xs flex-row justify-between items-center">
                <CookButton recipeId={recipe.id} size="large" className="mb-lg" />
                <View className="mb-lg">
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
                  <RecipeUsefulItems
                    usefulItems={recipe.usefulItems as RecipeUsefulItem[]}
                    className="mb-xxl"
                  />
                </SideColumn>

                <MainColumn className="pl-md border-l border-border-default">
                  <RecipeSteps steps={recipe.steps} className="mb-xxl" />
                  <RecipeTip text={recipe.tipsAndTricks} />
                </MainColumn>
              </ResponsiveColumnLayout>

              {/* Rating Distribution */}
              {isLoadingDistribution ? (
                <RatingDistributionSkeleton className="mt-lg mb-xl" />
              ) : ratingDistribution && totalRatings > 0 ? (
                <RatingDistribution
                  distribution={ratingDistribution}
                  total={totalRatings}
                  averageRating={averageRating}
                  className="mt-lg mb-xl"
                />
              ) : null}

              <CookButton recipeId={recipe.id} size="large" className="my-xxl" />
            </View>
          </Animated.ScrollView>
        </PageLayout>

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
