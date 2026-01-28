import React, { useEffect, useRef } from 'react';
import { Animated, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import type { LevelStatus } from '@/types/adventure';
import { COLORS } from '@/constants/design-tokens';

interface LevelNodeProps {
  title: string;
  description: string;
  durationLabel: string;
  rewardLabel: string;
  status: LevelStatus;
  showConnector: boolean;
  index: number;
  onPress?: () => void;
}

export function LevelNode({
  title,
  description,
  durationLabel,
  rewardLabel,
  status,
  showConnector,
  index,
  onPress,
}: LevelNodeProps) {
  const isLocked = status === 'locked';
  const isCompleted = status === 'completed';
  const iconName = isCompleted ? 'checkmark' : isLocked ? 'lock-closed' : 'play';
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 360,
      delay: index * 90,
      useNativeDriver: true,
    }).start();
    Animated.timing(translateY, {
      toValue: 0,
      duration: 360,
      delay: index * 90,
      useNativeDriver: true,
    }).start();
  }, [index, opacity, translateY]);

  return (
    <Animated.View
      className="flex-row items-start"
      style={{ opacity, transform: [{ translateY }] }}
    >
      <View className="items-center w-10">
        <View
          className={`w-10 h-10 rounded-full items-center justify-center border ${isLocked ? 'bg-grey-light border-grey-light' : 'bg-primary-light border-primary-medium'}`}
        >
          <Ionicons
            name={iconName as any}
            size={18}
            color={isLocked ? COLORS.grey.dark : COLORS.primary.darkest}
          />
        </View>
        {showConnector && <View className="w-1 flex-1 bg-grey-light mt-xs" />}
      </View>
      <TouchableOpacity
        className={`flex-1 ml-md p-md rounded-2xl border ${isLocked ? 'border-grey-light bg-grey-light' : 'border-primary-light bg-white'}`}
        activeOpacity={0.8}
        disabled={isLocked}
        onPress={onPress}
      >
        <Text preset="h3" className="text-lg">
          {title}
        </Text>
        <Text preset="body" className="text-sm text-grey-dark mt-xs">
          {description}
        </Text>
        <View className="flex-row flex-wrap mt-sm">
          <Text preset="caption" className="text-xs text-grey-dark mr-md mb-xs">
            {durationLabel}
          </Text>
          <Text preset="caption" className="text-xs text-grey-dark">
            {rewardLabel}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
