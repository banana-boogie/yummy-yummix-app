import React from 'react';
import { TouchableOpacity, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Text } from './Text';
import { useDevice } from '@/hooks/useDevice';
import { COLORS } from '@/constants/design-tokens';

export interface DangerButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  textClassName?: string;
}

export function DangerButton({
  label,
  onPress,
  disabled,
  className = '',
  style,
  textStyle,
  textClassName = ''
}: DangerButtonProps) {
  const { isLarge } = useDevice();

  return (
    <TouchableOpacity
      className={`
        p-md items-center justify-center self-center min-w-[200px]
        ${isLarge ? 'p-lg min-w-[250px]' : ''}
        ${disabled ? 'opacity-50' : ''}
        ${className}
      `}
      onPress={onPress}
      disabled={disabled}
      style={style}
    >
      <Text
        className={`
          text-base font-medium
          ${isLarge ? 'text-md' : ''}
          ${textClassName}
        `}
        color={disabled ? COLORS.text.secondary : COLORS.status.error}
        style={textStyle as any}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
