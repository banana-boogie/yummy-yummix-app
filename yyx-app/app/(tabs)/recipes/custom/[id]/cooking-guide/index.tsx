import { View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { useCustomRecipe } from '@/hooks/useCustomRecipe';
import { CookingGuideHeader } from '@/components/cooking-guide/CookingGuideHeader';
import { CookingGuidePageHeader } from '@/components/cooking-guide/CookingGuidePageHeader';
import { MessageBubble } from '@/components/cooking-guide/MessageBubble';
import { PageLayout } from '@/components/layouts/PageLayout';
import { useDevice } from '@/hooks/useDevice';
import i18n from '@/i18n';

import { COLORS } from '@/constants/design-tokens';
import * as Haptics from 'expo-haptics';
import { IrmixyCookingModal } from '@/components/cooking-guide/IrmixyCookingModal';
import { AskIrmixyButton } from '@/components/cooking-guide/AskIrmixyButton';
import { useIrmixyHelperChat } from '@/hooks/useIrmixyHelperChat';
import { getCustomCookingGuidePath, isFromChat } from '@/utils/navigation/recipeRoutes';
import { eventService } from '@/services/eventService';
export default function CustomCookingGuide() {
  const { id, from } = useLocalSearchParams<{ id: string; session?: string; from?: string }>();
  const { recipe, loading, error } = useCustomRecipe(id as string);
  const { isPhone } = useDevice();
  const navigation = useNavigation();
  const isChatFlow = isFromChat(from);
  const irmixy = useIrmixyHelperChat(id);

  const handleBackPress = () => {
    if (isChatFlow && !navigation.canGoBack()) {
      router.replace('/(tabs)/chat');
    } else {
      router.back();
    }
  };

  // Responsive sizes
  const checkboxSize = isPhone ? 32 : 40;
  const buttonSize = isPhone ? 'large' : 'medium';

  const handleStart = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (recipe?.id && recipe?.name) {
      eventService.logCookStart(recipe.id, recipe.name, 'user_recipes');
    }

    if (recipe?.kitchenTools && recipe.kitchenTools.length > 0) {
      router.push(getCustomCookingGuidePath(id as string, from, 'mise-en-place-kitchen-tools'));
    } else {
      router.push(getCustomCookingGuidePath(id as string, from, 'mise-en-place-ingredients'));
    }
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
          onPress={handleBackPress}
          className="mt-lg"
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <PageLayout
        backgroundColor={COLORS.grey.light}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 0 }}
        contentPaddingHorizontal={0}
        scrollEnabled={true}
      >
        <CookingGuideHeader
          showTitle={false}
          showSubtitle={false}
          showBackButton={true}
          onBackPress={handleBackPress}
          pictureUrl={recipe?.pictureUrl}
          isCustomRecipe={true}
          onExitPress={() => {
            if (isChatFlow) {
              router.replace('/(tabs)/chat');
            } else {
              router.replace(`/(tabs)/recipes/custom/${id}`);
            }
          }}
        />

        <CookingGuidePageHeader
          title={recipe?.name || ''}
          subtitle={i18n.t('chat.miseEnPlace')}
        />

        <View className="px-md">
          <MessageBubble className="mt-xxs">
            <View className="items-center mb-md">
              <Text preset="body" className="text-center text-md">
                {i18n.t('recipes.cookingGuide.intro.miseEnPlace.one')}
                <Text preset="body" className="text-center text-md font-bold">
                  {i18n.t('recipes.cookingGuide.intro.miseEnPlace.two')}
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

            <View className="items-center pb-sm pt-xs">
              <AskIrmixyButton onPress={irmixy.open} />
            </View>
            <View className="mx-lg mb-xs">
              <View className="h-[1px] bg-border-default opacity-30" />
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
      <IrmixyCookingModal
        visible={irmixy.isVisible}
        onClose={irmixy.close}
        recipeContext={{
          type: 'custom',
          recipeId: id as string,
          recipeTitle: recipe?.name,
        }}
        {...irmixy.sessionProps}
      />
    </View>
  );
}
