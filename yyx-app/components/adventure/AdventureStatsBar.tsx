import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';

interface AdventureStatsBarProps {
  streakLabel: string;
  xpLabel: string;
  coinsLabel: string;
  streakValue: string;
  xpValue: string;
  coinsValue: string;
}

export function AdventureStatsBar({
  streakLabel,
  xpLabel,
  coinsLabel,
  streakValue,
  xpValue,
  coinsValue,
}: AdventureStatsBarProps) {
  return (
    <View className="flex-row justify-between bg-white border border-primary-light rounded-2xl px-md py-sm">
      <View className="items-start">
        <Text preset="caption" className="text-[11px] uppercase tracking-wide text-grey-dark">
          {streakLabel}
        </Text>
        <Text preset="h3" className="text-lg">
          {streakValue}
        </Text>
      </View>
      <View className="items-start">
        <Text preset="caption" className="text-[11px] uppercase tracking-wide text-grey-dark">
          {xpLabel}
        </Text>
        <Text preset="h3" className="text-lg">
          {xpValue}
        </Text>
      </View>
      <View className="items-start">
        <Text preset="caption" className="text-[11px] uppercase tracking-wide text-grey-dark">
          {coinsLabel}
        </Text>
        <Text preset="h3" className="text-lg">
          {coinsValue}
        </Text>
      </View>
    </View>
  );
}
