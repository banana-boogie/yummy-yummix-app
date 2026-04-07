import { View, Platform, StatusBar, Animated, TouchableOpacity } from 'react-native';
import React, { useRef, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useQuery } from '@tanstack/react-query';

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
import { RecipeKitchenTools } from '@/components/recipe-detail/RecipeKitchenTools';
import { RecipeSteps } from '@/components/recipe-detail/RecipeSteps';
import { RecipeTip } from '@/components/recipe-detail/RecipeTip';
import { RecipeImageHeader } from '@/components/recipe-detail/RecipeDetailHeader';

import { PageLayout } from '@/components/layouts/PageLayout';
import { useDevice } from '@/hooks/useDevice';
import { ResponsiveColumnLayout, MainColumn, SideColumn } from '@/components/layouts/ResponsiveColumnLayout';
import { RecipeKitchenTool } from '@/types/recipe.types';
import { ShareButton } from '@/components/common/ShareButton';
import { useLanguage } from '@/contexts/LanguageContext';
import { IrmixyCookingModal } from '@/components/cooking-guide/IrmixyCookingModal';
import { useIrmixyHelperChat } from '@/hooks/useIrmixyHelperChat';
import { Image as ExpoImage } from 'expo-image';
import { buildRecipeContext } from '@/utils/recipeContext';
import logger from '@/services/logger';
import { RatingDistribution, RatingDistributionSkeleton, StarRating, StarRatingInput } from '@/components/rating';
import { useRecipeRating } from '@/hooks/useRecipeRating';
import { recipeCompletionService } from '@/services/recipeCompletionService';
import { RATING_REQUIRES_COMPLETION_ERROR } from '@/services/ratingService';

const RecipeDetail: React.FC = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  // Only proceed with valid UUID. Don't redirect on invalid IDs — on web,
  // Expo Router may mount this component alongside admin routes during refresh.
  // Redirecting would hijack navigation away from the correct screen.
  const validId = id && isValidUUID(id as string) ? (id as string) : '';
  const irmixy = useIrmixyHelperChat(validId);
  const { recipe, loading, error } = useRecipe(validId);

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

  const {
    data: hasCompletedRecipe = false,
    isLoading: isLoadingCompletionStatus,
  } = useQuery({
    queryKey: ['recipe-completion-status', validId, isLoggedIn],
    queryFn: () => recipeCompletionService.hasCompletedRecipe(validId),
    enabled: isLoggedIn && !!validId,
    staleTime: 1000 * 60,
  });

  useEffect(() => {
    if (recipe?.id && recipe?.name) {
      eventService.logRecipeView(recipe.id, recipe.name);
    }
  }, [recipe?.id, recipe?.name]);

  const handleInlineRating = useCallback((rating: number) => {
    submitRating(rating);
    if (recipe?.name) {
      eventService.logRatingSubmitted(
        validId, recipe.name, rating,
        false, false, 'inline',
      );
    }
  }, [submitRating, validId, recipe?.name]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const { isMedium } = useDevice();
  const { language: currentLanguage } = useLanguage();

  const handleBackPress = () => {
    if (Platform.OS === 'web') {
      window.history.back();
    } else {
      router.back();
    }
  };

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
  const isRatingGated = isLoggedIn && !isLoadingCompletionStatus && !hasCompletedRecipe;
  const isRatingInputDisabled = isSubmittingRating || isLoadingRating || isLoadingCompletionStatus || isRatingGated;
  const ratingErrorMessage = ratingError instanceof Error && ratingError.message === RATING_REQUIRES_COMPLETION_ERROR
    ? i18n.t('recipes.rating.completeRecipeToRate')
    : i18n.t('recipes.rating.submitError');
  const ratingHelperText = isRatingGated
    ? i18n.t('recipes.rating.completeRecipeToRate')
    : userRating
      ? i18n.t('recipes.rating.tapToUpdateRating')
      : i18n.t('recipes.rating.rateThisRecipe');

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
            <View className="w-full max-w-[500px] md:max-w-[700px] lg:max-w-[900px] self-center">
              <RecipeImageHeader
                pictureUrl={recipe.pictureUrl}
                onBackPress={handleBackPress}
                className="mb-md"
              />
            </View>

            <View className="w-full max-w-[500px] md:max-w-[700px] lg:max-w-[900px] self-center px-md">
              <Text preset="h1" className="mb-xs">
                {recipe.name}
              </Text>

              {recipe.description ? (
                <Text className="text-text-secondary text-base mb-md">
                  {recipe.description}
                </Text>
              ) : null}

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
                      onChange={handleInlineRating}
                      disabled={isRatingInputDisabled}
                      size="md"
                    />
                    <Text preset="caption" className="text-text-secondary mt-xs">
                      {ratingHelperText}
                    </Text>
                    {ratingError && (
                      <Text preset="caption" className="text-status-error mt-xs">
                        {ratingErrorMessage}
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

              <ResponsiveColumnLayout>
                <SideColumn className={`pr-md ${isMedium ? 'flex-[1.3]' : 'flex-1'}`}>
                  <RecipeIngredients
                    ingredients={recipe.ingredients}
                    className="mb-xxl"
                  />
                  <RecipeKitchenTools
                    kitchenTools={recipe.kitchenTools as RecipeKitchenTool[]}
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
        <TouchableOpacity
          onPress={irmixy.open}
          className="absolute bottom-6 right-6 rounded-full shadow-lg"
          style={{ zIndex: 100 }}
          accessibilityLabel={i18n.t('recipes.cookingGuide.navigation.askIrmixy')}
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <ExpoImage
            source={require('@/assets/images/irmixy-avatar/irmixy-face.png')}
            style={{ width: 56, height: 56, borderRadius: 28 }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </TouchableOpacity>
        <IrmixyCookingModal
          visible={irmixy.isVisible}
          onClose={irmixy.close}
          recipeContext={buildRecipeContext(recipe, { type: 'recipe', recipeId: id as string })}
          {...irmixy.sessionProps}
        />
      </View>
    </>
  );
};

export default RecipeDetail;
