import { View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { useRecipe } from '@/hooks/useRecipe';
import { CookingGuideHeader } from '@/components/cooking-guide/CookingGuideHeader';
import { CookingGuidePageHeader } from '@/components/cooking-guide/CookingGuidePageHeader';
import { MessageBubble } from '@/components/cooking-guide/MessageBubble';
import { PageLayout } from '@/components/layouts/PageLayout';
import { useDevice } from '@/hooks/useDevice';
import { IrmixyCookingModal } from '@/components/cooking-guide/IrmixyCookingModal';
import { AskIrmixyButton } from '@/components/cooking-guide/AskIrmixyButton';
import { useIrmixyHelperChat } from '@/hooks/useIrmixyHelperChat';
import i18n from '@/i18n';
import { eventService } from '@/services/eventService';
import { COLORS } from '@/constants/design-tokens';
import { formatSpeedText } from '@/utils/thermomix/assetUtils';

import * as Haptics from 'expo-haptics';

const contentContainerStyle = { paddingHorizontal: 0 } as const;

export default function CookingGuide() {
  const { id } = useLocalSearchParams();
  const { recipe } = useRecipe(id as string);
  const { isPhone } = useDevice();
  const irmixy = useIrmixyHelperChat(id as string);

  // Responsive sizes
  const checkboxSize = isPhone ? 32 : 40;
  const buttonSize = isPhone ? 'large' : 'medium';

  const handleStart = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Track cook start event
    if (recipe?.id && recipe?.name) {
      eventService.logCookStart(recipe.id, recipe.name);
    }

    if (recipe?.kitchenTools && recipe.kitchenTools.length > 0) {
      router.push(`/(tabs)/recipes/${id}/cooking-guide/mise-en-place-kitchen-tools`);
    } else {
      router.push(`/(tabs)/recipes/${id}/cooking-guide/mise-en-place-ingredients`);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <PageLayout
        backgroundColor={COLORS.grey.light}
        style={{ flex: 1 }}
        contentContainerStyle={contentContainerStyle}
        contentPaddingHorizontal={0}
        scrollEnabled={true}
      >
        <CookingGuideHeader
          showTitle={false}
          showSubtitle={false}
          showBackButton={true}
          pictureUrl={recipe?.pictureUrl}
          onExitPress={() => router.replace(`/(tabs)/recipes/${id}`)}
        />

        <CookingGuidePageHeader
          title={recipe?.name || ''}
          subtitle={i18n.t('recipes.cookingGuide.subtitle')}
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

            <View className="items-center mb-md gap-xs">
              <Text preset="body" className="text-center text-md">
                {i18n.t('recipes.cookingGuide.intro.checkboxSteps.checkmark')}
              </Text>
              <Image
                source={require('@/assets/images/icons/checkbox-checked.png')}
                style={{ width: checkboxSize, height: checkboxSize }}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
              <Text preset="body" className="text-center text-md">
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
          type: 'recipe',
          recipeId: id as string,
          recipeTitle: recipe?.name,
          ingredients: recipe?.ingredients?.map((i) => ({
            name: i.name,
            amount: `${i.formattedQuantity} ${i.formattedUnit}`.trim(),
          })),
          kitchenTools: recipe?.kitchenTools?.map((t) => t.name),
          allSteps: recipe?.steps?.map((s) => ({
            order: s.order,
            instruction: s.instruction,
            thermomixTime: s.thermomix?.time,
            thermomixSpeed: s.thermomix?.speed ? formatSpeedText(s.thermomix.speed) : null,
          })),
          portions: recipe?.portions,
          totalTime: recipe?.totalTime ?? undefined,
        }}
        {...irmixy.sessionProps}
      />
    </View>
  );
}
