/**
 * AddToPlanModal
 *
 * Lets a user add a recipe to a day+meal slot in their active meal plan.
 * If no active plan exists, prompts the user to create one by navigating
 * to the Week tab (graceful fallback if that tab is not yet built).
 */

import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, ToastAndroid, View, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { COLORS, SPACING } from '@/constants/design-tokens';
import i18n from '@/i18n';
import type { Recipe } from '@/types/recipe.types';
import type { MealPlan, MealPlanSlot } from '@/types/mealPlan';
import { useMealPlan } from '@/hooks/useMealPlan';
import { eventService } from '@/services/eventService';

export interface AddToPlanModalProps {
  visible: boolean;
  recipe: Recipe | null;
  onClose: () => void;
  activePlan?: MealPlan | null;
}

function t(key: string, fallback: string): string {
  const value = i18n.t(`recipes.addToPlan.${key}`);
  return value.startsWith('[missing') ? fallback : value;
}

function toast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert(message);
  }
}

function dayLabel(slot: MealPlanSlot): string {
  const date = new Date(slot.plannedDate);
  if (Number.isNaN(date.getTime())) return slot.plannedDate;
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export function AddToPlanModal({
  visible,
  recipe,
  onClose,
  activePlan,
}: AddToPlanModalProps) {
  const router = useRouter();
  const { addRecipeToSlot } = useMealPlan();
  const [busySlotId, setBusySlotId] = useState<string | null>(null);

  const handleCreatePlan = () => {
    onClose();
    try {
      router.push('/(tabs)/week');
    } catch {
      toast(t('weekComingSoon', 'Week tab coming soon'));
    }
  };

  const handleSlotPress = async (slot: MealPlanSlot) => {
    if (!recipe || !activePlan || busySlotId) return;
    setBusySlotId(slot.id);
    try {
      await addRecipeToSlot.mutateAsync({
        mealPlanId: activePlan.planId,
        mealPlanSlotId: slot.id,
        recipeId: recipe.id,
      });
      eventService.logExploreAddToPlan({
        recipeId: recipe.id,
        planId: activePlan.planId,
        slotId: slot.id,
        dayIndex: slot.dayIndex,
        mealType: slot.mealType,
      });
      toast(t('successToast', 'Added to your plan'));
      onClose();
    } catch {
      toast(t('errorToast', "Couldn't add to plan"));
    } finally {
      setBusySlotId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.35)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: COLORS.background.default,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: SPACING.lg,
            paddingTop: SPACING.lg,
            paddingBottom: SPACING.xl,
            maxHeight: '80%',
          }}
        >
          <Text preset="h2" className="text-text-default">
            {t('title', 'Add to Plan')}
          </Text>

          {!activePlan ? (
            <View style={{ gap: SPACING.md }}>
              <Text preset="body" className="text-text-secondary">
                {t('noPlanPrompt', 'No active plan yet. Create one first?')}
              </Text>
              <Button variant="primary" onPress={handleCreatePlan}>
                {t('createPlanCta', 'Create a plan')}
              </Button>
              <Button variant="outline" onPress={onClose}>
                {t('cancel', 'Cancel')}
              </Button>
            </View>
          ) : (
            <View>
              <Text preset="body" className="text-text-secondary mb-md">
                {t('selectSlot', 'Pick a day and meal')}
              </Text>
              <ScrollView style={{ maxHeight: 400 }}>
                {activePlan.slots.map((slot) => {
                  const busy = busySlotId === slot.id;
                  return (
                    <Pressable
                      key={slot.id}
                      disabled={busy}
                      onPress={() => handleSlotPress(slot)}
                      style={{
                        minHeight: 56,
                        paddingHorizontal: SPACING.md,
                        paddingVertical: SPACING.sm,
                        marginBottom: SPACING.sm,
                        borderRadius: 12,
                        backgroundColor: COLORS.background.secondary,
                        borderWidth: 1,
                        borderColor: COLORS.grey.default,
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      <Text preset="subheading" className="text-text-default" marginBottom={0}>
                        {dayLabel(slot)}
                      </Text>
                      <Text preset="bodySmall" className="text-text-secondary">
                        {slot.displayMealLabel || slot.mealType}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
