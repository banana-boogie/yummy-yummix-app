import React, { useState, useCallback, useEffect } from 'react';
import { View, ActivityIndicator, Pressable, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

/**
 * Explicit setup signal — do not infer from `preferences.mealTypes.length`,
 * because the backend stub returns default preferences that make every new
 * user look configured. The flag is set only after the user confirms the
 * guided setup flow.
 */
const SETUP_COMPLETED_KEY = 'planner.setupCompleted';

function todayDayIndex(): number {
  const day = new Date().getDay();
  return (day + 6) % 7;
}

export default function WeekScreen() {
  const [setupMode, setSetupMode] = useState<'first-time' | 'settings' | null>(
    null,
  );
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);
  const [approving, setApproving] = useState(false);

  const {
    activePlan,
    preferences,
    isLoading,
    isGenerating,
    generatePlan,
    swapSlot,
    skipSlot,
    generateShoppingList,
    planProgress,
    refetch,
  } = useMealPlan();

  useEffect(() => {
    AsyncStorage.getItem(SETUP_COMPLETED_KEY)
      .then((v) => setSetupCompleted(v === 'true'))
      .catch(() => setSetupCompleted(false));
  }, []);

  const handlePlanPress = useCallback(() => {
    if (!setupCompleted) {
      setSetupMode('first-time');
      return;
    }
    generatePlan({
      dayIndexes: preferences?.activeDayIndexes,
      mealTypes: preferences?.mealTypes,
      busyDays: preferences?.busyDays,
      preferLeftoversForLunch: preferences?.preferLeftoversForLunch,
    });
  }, [setupCompleted, generatePlan, preferences]);

  const handleSetupComplete = useCallback(
    async (answers: GeneratePlanOptions) => {
      setSetupMode(null);
      await mealPlanService.updatePreferences({
        dayIndexes: answers.dayIndexes,
        mealTypes: answers.mealTypes,
        busyDays: answers.busyDays,
      });
      await AsyncStorage.setItem(SETUP_COMPLETED_KEY, 'true');
      setSetupCompleted(true);
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
      // The Shopping tab lives in a separate track. Attempt to navigate; if the
      // route doesn't exist in this build, surface a non-blocking confirmation
      // so the approval still feels successful.
      try {
        router.push('/(tabs)/shopping' as any);
      } catch {
        if (Platform.OS !== 'web') {
          Alert.alert(i18n.t('planner.cta.approved'));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(i18n.t('planner.error.shoppingListTitle'), message);
    } finally {
      setApproving(false);
    }
  }, [activePlan, generateShoppingList]);

  const handleSwap = useCallback(
    async (slot: { id: string }) => {
      try {
        await swapSlot(slot.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Alert.alert(i18n.t('planner.error.swapTitle'), message);
      }
    },
    [swapSlot],
  );

  const handleRemove = useCallback(
    (slot: { id: string }) => {
      // Remove dims the card via skip_meal (no dedicated "remove" action yet —
      // see triage; keep server contract intact, surface as "Remove" in UI).
      skipSlot(slot.id);
    },
    [skipSlot],
  );

  if (setupMode) {
    return (
      <FirstTimePlanSetupFlow
        mode={setupMode}
        initialPreferences={preferences ?? undefined}
        onCancel={() => setSetupMode(null)}
        onComplete={handleSetupComplete}
      />
    );
  }

  const hasPlan = !!activePlan && activePlan.slots.length > 0;
  // Stub backend may return plan: null after generate_plan. Show a dedicated
  // "we're still putting your week together" state instead of bouncing to the
  // empty CTA.
  const showGeneratingPlaceholder =
    setupCompleted === true && isGenerating && !hasPlan;
  const showPlanPendingPlaceholder =
    setupCompleted === true && !isGenerating && !hasPlan && !isLoading;

  return (
    <PageLayout
      header={
        <View className="flex-row items-center justify-between px-lg pt-lg pb-sm">
          <Text preset="h1">{i18n.t('planner.title')}</Text>
          {setupCompleted && (
            <Pressable
              onPress={() => setSetupMode('settings')}
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
      {isLoading || setupCompleted === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={COLORS.primary.darkest} />
        </View>
      ) : hasPlan ? (
        <MealPlanView
          plan={activePlan}
          todayDayIndex={todayDayIndex()}
          progress={planProgress}
          isApproving={approving}
          onApprove={handleApprove}
          onSwap={handleSwap}
          onRemove={handleRemove}
        />
      ) : showGeneratingPlaceholder ? (
        <View className="flex-1 items-center justify-center px-lg">
          <ActivityIndicator color={COLORS.primary.darkest} />
          <Text preset="body" className="text-center mt-md">
            {i18n.t('planner.setup.generating')}
          </Text>
        </View>
      ) : showPlanPendingPlaceholder ? (
        <View className="flex-1 items-center justify-center px-lg">
          <Text preset="body" className="text-center text-text-secondary">
            {i18n.t('planner.planReadyPlaceholder')}
          </Text>
          <Pressable
            onPress={handlePlanPress}
            className="mt-lg px-xl py-md rounded-full bg-primary-medium"
            style={{ minHeight: 44 }}
            accessibilityLabel={i18n.t('planner.empty.planMyWeek')}
          >
            <Text preset="body">{i18n.t('planner.empty.planMyWeek')}</Text>
          </Pressable>
        </View>
      ) : (
        <MealPlanEmptyState
          variant={setupCompleted ? 'ready' : 'first-time'}
          onPressPlan={handlePlanPress}
          loading={isGenerating}
        />
      )}
    </PageLayout>
  );
}
