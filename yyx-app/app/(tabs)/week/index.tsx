import React, { useState, useCallback } from 'react';
import { View, ActivityIndicator, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { PageLayout } from '@/components/layouts/PageLayout';
import { Text } from '@/components/common';
import { useMealPlan } from '@/hooks/useMealPlan';
import { MealPlanEmptyState } from '@/components/planner/MealPlanEmptyState';
import { FirstTimePlanSetupFlow } from '@/components/planner/FirstTimePlanSetupFlow';
import { MealPlanView } from '@/components/planner/MealPlanView';
import { mealPlanService } from '@/services/mealPlanService';
import i18n from '@/i18n';
import { COLORS } from '@/constants/design-tokens';
import type { GeneratePlanOptions } from '@/types/mealPlan';

function todayDayIndex(): number {
  // meal-slot-schema uses Monday = 0
  const day = new Date().getDay();
  return (day + 6) % 7;
}

export default function WeekScreen() {
  const [setupOpen, setSetupOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const {
    activePlan,
    preferences,
    isLoading,
    isGenerating,
    generatePlan,
    swapSlot,
    skipSlot,
    markCooked,
    generateShoppingList,
    planProgress,
    refetch,
  } = useMealPlan();

  const hasSetup = !!preferences && preferences.mealTypes.length > 0;

  const handlePlanPress = useCallback(() => {
    if (!hasSetup) {
      setSetupOpen(true);
      return;
    }
    generatePlan({
      dayIndexes: preferences?.activeDayIndexes,
      mealTypes: preferences?.mealTypes,
      busyDays: preferences?.busyDays,
      preferLeftoversForLunch: preferences?.preferLeftoversForLunch,
    });
  }, [hasSetup, generatePlan, preferences]);

  const handleSetupComplete = useCallback(
    async (answers: GeneratePlanOptions) => {
      setSetupOpen(false);
      await mealPlanService.updatePreferences({
        dayIndexes: answers.dayIndexes,
        mealTypes: answers.mealTypes,
        busyDays: answers.busyDays,
      });
      await generatePlan(answers);
      refetch();
    },
    [generatePlan, refetch],
  );

  const handleApprove = useCallback(async () => {
    if (!activePlan) return;
    setApproving(true);
    try {
      await generateShoppingList();
      router.push('/(tabs)/shopping' as any);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(i18n.t('planner.error.shoppingListTitle'), message);
    } finally {
      setApproving(false);
    }
  }, [activePlan, generateShoppingList]);

  const handleSwap = useCallback(
    async (slot: Parameters<typeof swapSlot> extends [infer _S, ...any[]] ? any : any) => {
      try {
        await swapSlot(slot.id);
        // The SwapMealSheet will land with the ranking PR — for now we
        // just surface that alternatives were loaded.
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Alert.alert(i18n.t('planner.error.swapTitle'), message);
      }
    },
    [swapSlot],
  );

  if (setupOpen) {
    return (
      <FirstTimePlanSetupFlow
        initialPreferences={preferences ?? undefined}
        onCancel={() => setSetupOpen(false)}
        onComplete={handleSetupComplete}
      />
    );
  }

  return (
    <PageLayout
      header={
        <View className="flex-row items-center justify-between px-lg pt-lg pb-sm">
          <Text preset="h1">{i18n.t('planner.title')}</Text>
          {hasSetup && (
            <Pressable
              onPress={() => setSetupOpen(true)}
              accessibilityLabel={i18n.t('planner.openSettings')}
              hitSlop={12}
            >
              <Ionicons
                name="settings-outline"
                size={24}
                color={COLORS.text.default}
              />
            </Pressable>
          )}
        </View>
      }
    >
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={COLORS.primary.darkest} />
        </View>
      ) : activePlan && activePlan.slots.length > 0 ? (
        <MealPlanView
          plan={activePlan}
          todayDayIndex={todayDayIndex()}
          progress={planProgress}
          isApproving={approving}
          onApprove={handleApprove}
          onCook={(slot) => markCooked(slot.id)}
          onSwap={handleSwap}
          onSkip={(slot) => skipSlot(slot.id)}
        />
      ) : (
        <MealPlanEmptyState
          variant={hasSetup ? 'ready' : 'first-time'}
          onPressPlan={handlePlanPress}
          loading={isGenerating}
        />
      )}
    </PageLayout>
  );
}
