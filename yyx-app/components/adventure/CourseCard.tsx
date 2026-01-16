import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';

interface CourseCardProps {
  title: string;
  description: string;
  progressLabel: string;
  isPlayable: boolean;
  onPress?: () => void;
  badgeLabel: string;
}

export function CourseCard({
  title,
  description,
  progressLabel,
  isPlayable,
  onPress,
  badgeLabel,
}: CourseCardProps) {
  return (
    <TouchableOpacity
      className={`rounded-2xl border ${isPlayable ? 'border-primary-light bg-white' : 'border-grey-light bg-grey-light'} p-md mr-md w-[260px]`}
      activeOpacity={0.8}
      disabled={!isPlayable}
      onPress={onPress}
    >
      <View className="flex-row items-center justify-between">
        <Text preset="h3" className="text-lg">
          {title}
        </Text>
        <View className={`px-sm py-1 rounded-full ${isPlayable ? 'bg-primary-light' : 'bg-grey-light'}`}>
          <Text preset="caption" className="text-[11px] uppercase tracking-wide text-grey-dark">
            {badgeLabel}
          </Text>
        </View>
      </View>
      <Text preset="body" className="text-sm text-grey-dark mt-xs">
        {description}
      </Text>
      <View className="mt-md">
        <Text preset="caption" className="text-xs text-grey-dark">
          {progressLabel}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
