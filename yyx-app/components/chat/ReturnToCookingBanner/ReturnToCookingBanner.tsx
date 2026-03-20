/**
 * ReturnToCookingBanner — Shows at the top of the chat screen when a cooking
 * session is active. Tapping navigates back to the exact cooking step.
 *
 * Lupita-friendly: large touch target, clear label, visible dismiss button.
 */
import React, { useCallback } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import { useCookingSession } from '@/contexts/CookingSessionContext';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

export function ReturnToCookingBanner() {
  const { activeCookingSession, clearCookingSession } = useCookingSession();
  const router = useRouter();

  const handleReturn = useCallback(() => {
    if (!activeCookingSession) return;

    const { recipeId, currentStep, isCustom, from } = activeCookingSession;

    if (isCustom) {
      const base = from === 'chat' ? '/recipe/custom' : '/(tabs)/recipes/custom';
      const path = `${base}/${encodeURIComponent(recipeId)}/cooking-guide/${currentStep}`;
      const fullPath = from === 'chat' ? `${path}?from=chat` : path;
      router.navigate(fullPath as any);
    } else {
      router.navigate(`/(tabs)/recipes/${encodeURIComponent(recipeId)}/cooking-guide/${currentStep}` as any);
    }
  }, [activeCookingSession]);

  const handleDismiss = useCallback(() => {
    clearCookingSession();
  }, [clearCookingSession]);

  if (!activeCookingSession) return null;

  const { recipeName, currentStep } = activeCookingSession;

  return (
    <View className="mx-md mt-sm mb-xs">
      <Pressable
        onPress={handleReturn}
        className="bg-primary-light rounded-lg px-md py-sm flex-row items-center shadow-sm"
        accessibilityLabel={i18n.t('chat.returnToCooking')}
        accessibilityRole="button"
      >
        <MaterialCommunityIcons
          name="pot-steam"
          size={24}
          color={COLORS.primary.darkest}
        />
        <View className="flex-1 ml-sm mr-sm">
          <Text preset="body" className="font-semibold text-text-default">
            {i18n.t('chat.returnToCooking')}
          </Text>
          <Text preset="bodySmall" className="text-text-secondary">
            {i18n.t('chat.returnToCookingStep', { step: currentStep, recipeName })}
          </Text>
        </View>
        <Pressable
          onPress={handleDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel={i18n.t('common.dismiss')}
          accessibilityRole="button"
          className="p-xs"
        >
          <MaterialCommunityIcons
            name="close"
            size={20}
            color={COLORS.text.secondary}
          />
        </Pressable>
      </Pressable>
    </View>
  );
}
