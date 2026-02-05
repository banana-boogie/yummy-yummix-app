import { View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { useCustomRecipe } from '@/hooks/useCustomRecipe';
import { CookingGuideHeader } from '@/components/cooking-guide/CookingGuideHeader';
import { CookingGuidePageHeader } from '@/components/cooking-guide/CookingGuidePageHeader';
import { MessageBubble } from '@/components/cooking-guide/MessageBubble';
import { PageLayout } from '@/components/layouts/PageLayout';
import { useDevice } from '@/hooks/useDevice';
import i18n from '@/i18n';

import * as Haptics from 'expo-haptics';

export default function CustomCookingGuide() {
  const { id, session } = useLocalSearchParams();
  const { recipe, loading, error } = useCustomRecipe(id as string);
  const { isPhone } = useDevice();

  // Debug: log recipe ID and session to trace navigation issues
  if (__DEV__) {
    console.log('[CookingGuide] Rendering with id:', id, 'session:', session, 'recipe:', recipe?.name);
  }

  // Responsive sizes: keep mobile original, make desktop larger
  const chefSize = isPhone ? { width: 165, height: 270 } : { width: 180, height: 270 };
  const checkboxSize = isPhone ? 32 : 40;
  const buttonSize = isPhone ? 'large' : 'medium';

  const handleStart = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push(`/(tabs)/recipes/custom/${id}/cooking-guide/mise-en-place-ingredients`);
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-background-default">
        <Text preset="body">{i18n.t('common.loading')}</Text>
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View className="flex-1 justify-center items-center bg-background-default px-lg">
        <Text preset="body" className="text-status-error text-center">
          {error || i18n.t('common.errors.default')}
        </Text>
        <Button
          variant="secondary"
          label={i18n.t('common.back')}
          onPress={() => router.back()}
          className="mt-lg"
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <PageLayout
        backgroundColor="#f9f9f9"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 0, paddingBottom: 180 }}
        contentPaddingHorizontal={0}
        scrollEnabled={true}
        footer={
          <View className="w-full max-w-[800px] self-center relative h-0" pointerEvents="none">
            <Image
              source={require('@/assets/images/irmixy-avatar/1.png')}
              className="absolute bottom-[-50px] right-0"
              style={{ width: chefSize.width, height: chefSize.height }}
              contentFit="contain"
            />
          </View>
        }
      >
        <CookingGuideHeader
          showTitle={false}
          showSubtitle={false}
          showBackButton={true}
          pictureUrl={recipe?.pictureUrl}
          isCustomRecipe={true}
        />

        <CookingGuidePageHeader
          title={recipe?.name || ''}
          subtitle={i18n.t('chat.miseEnPlace')}
          recipeContext={{
            type: 'custom',
            recipeId: id as string,
            recipeTitle: recipe?.name
          }}
        />

        <View className="px-md">
          <MessageBubble className="mt-xxs">
            <View className="items-center mb-md">
              <Text preset="h1" className="text-center text-lg">
                {i18n.t('recipes.cookingGuide.intro.greeting')}
              </Text>
            </View>

            <View className="items-center mb-md">
              <Text preset="body" className="text-center text-md">
                {i18n.t('recipes.cookingGuide.intro.miseEnPlace.one')}
                <Text preset="body" className="text-center text-md font-bold">
                  {i18n.t('recipes.cookingGuide.intro.miseEnPlace.two')}
                </Text>
                <Text preset="body" className="text-center text-md">
                  {i18n.t('recipes.cookingGuide.intro.miseEnPlace.three')}
                </Text>
              </Text>
            </View>

            <View className="flex-row flex-wrap items-center justify-center mb-md">
              <Text preset="body" className="text-center text-md mb-0">
                {i18n.t('recipes.cookingGuide.intro.checkboxSteps.checkmark')}
              </Text>
              <View className="items-center justify-center mx-xs position-absolute">
                <Image
                  source={require('@/assets/images/icons/checkbox-checked.png')}
                  style={{ width: checkboxSize, height: checkboxSize, top: -5 }}
                />
              </View>
              <Text preset="body" className="text-center text-md mb-0">
                {i18n.t('recipes.cookingGuide.intro.checkboxSteps.steps')}
              </Text>
            </View>

            <Button
              variant='primary'
              size={buttonSize}
              label={i18n.t('recipes.cookingGuide.start')}
              onPress={handleStart}
              className="self-center mt-lg mb-xl py-lg px-xxxl shadow-md"
              textClassName="font-semibold"
            />
          </MessageBubble>
        </View>
      </PageLayout>
    </View>
  );
}
