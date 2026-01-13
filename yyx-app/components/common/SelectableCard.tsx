import React from 'react';
import { Pressable, ViewStyle, Image, ImageSourcePropType, View, TextStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';

interface SelectableCardProps {
  selected: boolean;
  onPress: () => void;
  label: string;
  icon?: ImageSourcePropType;
  className?: string; // Add className support
  style?: ViewStyle;
}

export function SelectableCard({
  selected,
  onPress,
  label,
  icon,
  className = '',
  style
}: SelectableCardProps) {
  return (
    <Pressable
      className={`
        p-md rounded-lg bg-background-secondary border-2 border-transparent flex-row items-center justify-between
        ${selected ? 'border-primary-medium bg-primary-light' : ''}
        ${className}
      `}
      onPress={onPress}
      style={style}
    >
      <View className="flex-row items-center flex-1">
        {icon && (
          <Image
            source={icon}
            className="w-8 h-8 mr-3"
            resizeMode="contain"
          />
        )}
        <Text
          preset="body"
          className={`
            text-text-default flex-1
            ${selected ? 'font-semibold' : ''}
          `}
        >
          {label}
        </Text>
      </View>

      {selected && (
        <View className="ml-3">
          <Ionicons
            name="checkmark-circle"
            size={24}
            color="#2D2D2D" // primary.DARK approximation or just keep it simple
          />
        </View>
      )}
    </Pressable>
  );
}
