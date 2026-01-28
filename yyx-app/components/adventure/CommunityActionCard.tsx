import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';

interface CommunityActionCardProps {
  title: string;
  description: string;
  onPress: () => void;
}

export function CommunityActionCard({ title, description, onPress }: CommunityActionCardProps) {
  return (
    <TouchableOpacity
      className="flex-1 rounded-2xl border border-primary-light bg-white p-md"
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View>
        <Text preset="h3" className="text-lg">
          {title}
        </Text>
        <Text preset="body" className="text-sm text-grey-dark mt-xs">
          {description}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
