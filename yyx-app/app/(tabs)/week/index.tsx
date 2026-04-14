import React, { useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { PageLayout } from '@/components/layouts/PageLayout';
import { Text } from '@/components/common';
import { useMealPlan } from '@/hooks/useMealPlan';
import { MealPlanEmptyState } from '@/components/planner/MealPlanEmptyState';
import i18n from '@/i18n';
import { COLORS } from '@/constants/design-tokens';

export default function WeekScreen() {
  const { preferences, isLoading, isGenerating, generatePlan } = useMealPlan();

  const hasSetup = !!preferences && preferences.mealTypes.length > 0;

  const handlePlan = useCallback(() => {
    if (!hasSetup) return;
    generatePlan({
      dayIndexes: preferences?.activeDayIndexes,
      mealTypes: preferences?.mealTypes,
      busyDays: preferences?.busyDays,
      preferLeftoversForLunch: preferences?.preferLeftoversForLunch,
    });
  }, [hasSetup, generatePlan, preferences]);

  return (
    <PageLayout
      header={
        <View className="px-lg pt-lg pb-sm">
          <Text preset="h1">{i18n.t('planner.title')}</Text>
        </View>
      }
    >
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={COLORS.primary.darkest} />
        </View>
      ) : (
        <MealPlanEmptyState
          variant={hasSetup ? 'ready' : 'first-time'}
          onPressPlan={handlePlan}
          loading={isGenerating}
        />
      )}
    </PageLayout>
  );
}
