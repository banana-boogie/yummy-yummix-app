import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { TimeframeFilter } from '@/services/analyticsService';
import i18n from '@/i18n';

const TIMEFRAME_OPTIONS: { value: TimeframeFilter; labelKey: string }[] = [
  { value: 'today', labelKey: 'admin.analytics.timeframes.today' },
  { value: '7_days', labelKey: 'admin.analytics.timeframes.sevenDays' },
  { value: '30_days', labelKey: 'admin.analytics.timeframes.thirtyDays' },
  { value: 'all_time', labelKey: 'admin.analytics.timeframes.allTime' },
];

export function TimeframeSelector({ value, onChange }: {
  value: TimeframeFilter;
  onChange: (value: TimeframeFilter) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-xs mb-md">
      {TIMEFRAME_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.value}
          className={`px-md py-sm rounded-full ${value === option.value ? 'bg-primary-medium' : 'bg-white border border-border-default'
            }`}
          onPress={() => onChange(option.value)}
        >
          <Text
            preset="bodySmall"
            className={value === option.value ? 'text-text-default font-semibold' : 'text-text-secondary'}
          >
            {i18n.t(option.labelKey)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
