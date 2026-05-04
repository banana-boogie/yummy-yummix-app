import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/common';
import i18n from '@/i18n';
import type { PlanProgress } from '@/types/mealPlan';

interface MealPlanProgressBarProps {
  progress: PlanProgress;
}

export function MealPlanProgressBar({ progress }: MealPlanProgressBarProps) {
  const { planned, cooked } = progress;
  const pct = planned > 0 ? Math.min(1, cooked / planned) : 0;

  return (
    <View className="px-lg py-sm">
      <View className="flex-row items-center justify-between mb-xxs">
        <Text preset="caption" className="text-text-secondary">
          {i18n.t('planner.progress.label', { cooked, planned })}
        </Text>
      </View>
      <View className="h-xxxs bg-grey-light rounded-full overflow-hidden">
        <View
          className="h-full bg-status-success"
          style={{ width: `${pct * 100}%` }}
        />
      </View>
    </View>
  );
}
