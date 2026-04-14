import React, { useState, useCallback } from 'react';
import { View, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PageLayout } from '@/components/layouts/PageLayout';
import { Text } from '@/components/common';
import { useMealPlan } from '@/hooks/useMealPlan';
import { MealPlanEmptyState } from '@/components/planner/MealPlanEmptyState';
import { FirstTimePlanSetupFlow } from '@/components/planner/FirstTimePlanSetupFlow';
import { mealPlanService } from '@/services/mealPlanService';
import i18n from '@/i18n';
import { COLORS } from '@/constants/design-tokens';

export default function WeekScreen() {
  const [setupOpen, setSetupOpen] = useState(false);
  const {
    activePlan,
    preferences,
    isLoading,
    isGenerating,
    generatePlan,
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
    async (answers: Parameters<typeof generatePlan>[0]) => {
      setSetupOpen(false);
      if (answers) {
        await mealPlanService.updatePreferences({
          dayIndexes: answers.dayIndexes,
          mealTypes: answers.mealTypes,
          busyDays: answers.busyDays,
        });
      }
      await generatePlan(answers);
      refetch();
    },
    [generatePlan, refetch],
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
        <View className="flex-1 items-center justify-center px-lg">
          <Text preset="body" className="text-center text-text-secondary">
            {i18n.t('planner.planReadyPlaceholder')}
          </Text>
        </View>
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
