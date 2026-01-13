import React from 'react';
import { TouchableOpacity, View, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { COLORS } from '@/constants/design-tokens';

interface CheckboxButtonProps {
  checked: boolean;
  onPress: () => void;
  label: string;
  disabled?: boolean;
  className?: string;
  textClassName?: string;
  checkboxClassName?: string;
  style?: ViewStyle;
  textStyle?: TextStyle | TextStyle[];
  checkboxStyle?: ViewStyle;
  checkboxSize?: number;
  checkIconSize?: number;
  checkIconColor?: string;
  strikethrough?: boolean;
}

export function CheckboxButton({
  checked,
  onPress,
  label,
  disabled = false,
  className = '',
  textClassName = '',
  checkboxClassName = '',
  style,
  textStyle,
  checkboxStyle,
  checkboxSize = 20,
  checkIconSize = 16,
  checkIconColor = COLORS.primary.medium,
  strikethrough = true,
}: CheckboxButtonProps) {
  return (
    <TouchableOpacity
      className={`flex-row items-center py-xxs ${className}`}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={style}
    >
      <View className="mr-sm">
        <View
          className={`
            rounded-[4px] border border-primary-medium justify-center items-center bg-background
            ${checkboxClassName}
          `}
          style={[
            { width: checkboxSize, height: checkboxSize },
            checkboxStyle
          ]}
        >
          {checked && (
            <Ionicons
              name="checkmark"
              size={checkIconSize}
              color={checkIconColor}
            />
          )}
        </View>
      </View>
      <Text
        preset="body"
        className={`
          flex-1 text-text-default
          ${(checked && strikethrough) ? 'line-through text-text-secondary' : ''}
          ${textClassName}
        `}
        style={textStyle as any}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
