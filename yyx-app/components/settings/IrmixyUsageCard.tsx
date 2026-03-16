import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Text } from '@/components/common/Text';
import { useBudgetUsage } from '@/hooks/useBudgetUsage';
import i18n from '@/i18n';

/**
 * Displays the user's Irmixy AI usage as a percentage with a progress bar.
 * Shown in the Settings screen. Colors shift to error when usage exceeds 80%.
 */
export function IrmixyUsageCard() {
  const { usage, loading, error } = useBudgetUsage();

  if (loading) {
    return (
      <View className="mb-xl">
        <Text className="text-text-secondary text-base mb-sm font-medium">
          {i18n.t('settings.irmixyUsage')}
        </Text>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (error || !usage) {
    // Silently hide if we can't load usage data — not critical
    return null;
  }

  const isHighUsage = usage.usagePercent > 80;
  const barColorClass = isHighUsage ? 'bg-status-error' : 'bg-primary-medium';
  const percentTextClass = isHighUsage ? 'text-status-error' : 'text-text-secondary';

  return (
    <View className="mb-xl">
      <Text className="text-text-secondary text-base mb-sm font-medium">
        {i18n.t('settings.irmixyUsage')}
      </Text>

      <View className="bg-background-default rounded-lg p-md shadow-sm border border-border-default">
        {/* Usage label + percentage */}
        <View className="flex-row justify-between items-center mb-sm">
          <Text preset="bodySmall" className="text-text-default">
            {i18n.t('settings.irmixyUsageLabel')}
          </Text>
          <Text preset="bodySmall" className={`font-semibold ${percentTextClass}`}>
            {i18n.t('settings.irmixyUsagePct', { percent: usage.usagePercent })}
          </Text>
        </View>

        {/* Progress bar */}
        <View className="h-[8px] bg-grey-default rounded-round overflow-hidden">
          <View
            className={`h-full rounded-round ${barColorClass}`}
            style={{ width: `${Math.min(usage.usagePercent, 100)}%` }}
          />
        </View>

        {/* Monthly reset note */}
        <Text preset="caption" className="mt-xs">
          {i18n.t('settings.irmixyUsageReset')}
        </Text>
      </View>
    </View>
  );
}
