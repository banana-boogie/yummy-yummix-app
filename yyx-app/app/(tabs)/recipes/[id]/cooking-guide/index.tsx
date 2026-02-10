import { View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { useRecipe } from '@/hooks/useRecipe';
import { CookingGuideHeader } from '@/components/cooking-guide/CookingGuideHeader';
import { MessageBubble } from '@/components/cooking-guide/MessageBubble';
import { PageLayout } from '@/components/layouts/PageLayout';
import { useDevice } from '@/hooks/useDevice';
import i18n from '@/i18n';
import { eventService } from '@/services/eventService';
import { COLORS } from '@/constants/design-tokens';

import * as Haptics from 'expo-haptics';

const contentContainerStyle = { paddingHorizontal: 0, paddingBottom: 180 } as const;

export default function CookingGuide() {
  const { id } = useLocalSearchParams();
  const { recipe } = useRecipe(id as string);
  const { isPhone } = useDevice();

  // Responsive sizes: keep mobile original, make desktop larger
  const chefSize = isPhone ? { width: 165, height: 270 } : { width: 180, height: 270 };
  const checkboxSize = isPhone ? 32 : 40;
  const buttonSize = isPhone ? 'large' : 'medium';

  const handleStart = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Track cook start event
    if (recipe?.id && recipe?.name) {
      eventService.logCookStart(recipe.id, recipe.name);
    }

    router.push(`/(tabs)/recipes/${id}/cooking-guide/mise-en-place-ingredients`);
  };

  return (
    <PageLayout
      backgroundColor={COLORS.grey.light}
      style={{ flex: 1 }}
      contentContainerStyle={contentContainerStyle}
      contentPaddingHorizontal={0}
      scrollEnabled={true}
      footer={
        <View className="w-full max-w-[800px] self-center relative h-0" pointerEvents="none">
          <Image
            source={require('@/assets/images/cooking-guide-chef.png')}
            className="absolute bottom-[-50px] right-0"
            style={{ width: chefSize.width, height: chefSize.height }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </View>
      }
    >
      <CookingGuideHeader
        title={recipe?.name || ''}
        titlePreset='h1'
        showBackButton={true}
        subtitle={i18n.t('recipes.cookingGuide.subtitle')}
        subtitlePreset='subheading'
        pictureUrl={recipe?.pictureUrl}
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
                contentFit="contain"
                cachePolicy="memory-disk"
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
  );
}
