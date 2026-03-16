/**
 * AskIrmixyButton — Navigates from cooking guide to Irmixy chat tab.
 *
 * Saves the current cooking session so the user can return to the exact step.
 * Designed to be always visible in the footer area of each cooking step,
 * so Lupita never has to hunt for it.
 */
import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '@/components/common/Button';
import { useCookingSession } from '@/contexts/CookingSessionContext';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

interface AskIrmixyButtonProps {
  recipeId: string;
  recipeName: string;
  currentStep: number;
  totalSteps: number;
  isCustom?: boolean;
  from?: string;
}

export function AskIrmixyButton({
  recipeId,
  recipeName,
  currentStep,
  totalSteps,
  isCustom = false,
  from,
}: AskIrmixyButtonProps) {
  const { startCookingSession } = useCookingSession();
  const router = useRouter();

  const handlePress = useCallback(() => {
    startCookingSession({
      recipeId,
      recipeName,
      currentStep,
      totalSteps,
      isCustom,
      from,
    });
    router.navigate('/(tabs)/chat' as any);
  }, [recipeId, recipeName, currentStep, totalSteps, isCustom, from, startCookingSession, router]);

  return (
    <Button
      variant="outline"
      size="small"
      onPress={handlePress}
      icon={
        <MaterialCommunityIcons
          name="chat-question-outline"
          size={18}
          color={COLORS.primary.darkest}
        />
      }
      label={i18n.t('recipes.cookingGuide.navigation.askIrmixy')}
      accessibilityLabel={i18n.t('recipes.cookingGuide.navigation.askIrmixy')}
    />
  );
}
