import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';

export function ListItem({ rank, label, value }: { rank: number; label: string; value: number }) {
  return (
    <View className="flex-row items-center py-sm px-md bg-white rounded-md mb-xs">
      <Text preset="body" className="text-text-secondary w-[30px]">{rank}.</Text>
      <Text preset="body" className="flex-1 text-text-default" numberOfLines={1}>{label}</Text>
      <Text preset="body" className="text-text-secondary font-semibold">{value}</Text>
    </View>
  );
}
