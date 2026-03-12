import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';

export function MetricCard({ title, value, subtitle, icon, tooltip }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tooltip?: string;
}) {
  return (
    <View className="bg-white rounded-lg p-md shadow-sm flex-1 min-w-[140px] m-xs">
      <View className="flex-row items-center mb-xs">
        {icon && (
          <Ionicons name={icon} size={18} color={COLORS.text.secondary} style={{ marginRight: 8 }} />
        )}
        <Text preset="caption" className="text-text-secondary">{title}</Text>
      </View>
      <Text preset="h1" className="text-text-default">{value}</Text>
      {subtitle && (
        <Text preset="caption" className="text-text-secondary mt-xxs">{subtitle}</Text>
      )}
      {tooltip && (
        <Text preset="caption" className="text-text-secondary mt-xs">{tooltip}</Text>
      )}
    </View>
  );
}
