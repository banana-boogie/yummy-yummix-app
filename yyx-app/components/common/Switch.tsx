import React from 'react';
import { Switch as RNSwitch, View, StyleProp, ViewStyle } from 'react-native';
import { COLORS } from '@/constants/design-tokens';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string; // Add className support
  containerClassName?: string;
  containerStyle?: StyleProp<ViewStyle>;
  trackColor?: {
    false: string;
    true: string;
  };
  thumbColor?: {
    false: string;
    true: string;
  };
}

export const Switch: React.FC<SwitchProps> = ({
  value,
  onValueChange,
  className = '',
  containerClassName = '',
  containerStyle,
  disabled = false,
  trackColor,
  thumbColor,
}) => {
  // Define default colors based on the app's color scheme
  const defaultTrackColor = {
    false: COLORS.background.secondary,
    true: COLORS.primary.default,
  };

  const defaultThumbColor = {
    false: COLORS.background.default,
    true: COLORS.primary.light,
  };

  // Merge default colors with provided colors
  const finalTrackColor = {
    ...defaultTrackColor,
    ...(trackColor || {}),
  };

  const finalThumbColor = {
    ...defaultThumbColor,
    ...(thumbColor || {}),
  };

  return (
    <View className={`${containerClassName} ${className}`} style={containerStyle}>
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={finalTrackColor}
        thumbColor={value ? finalThumbColor.true : finalThumbColor.false}
        ios_backgroundColor={finalTrackColor.false}
      />
    </View>
  );
};

export default Switch;
