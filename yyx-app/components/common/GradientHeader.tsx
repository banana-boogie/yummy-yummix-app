import React from 'react';
import { ViewStyle, StatusBar, View, StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENT } from '@/constants/design-tokens';

interface GradientHeaderProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  expandToFill?: boolean;
}

export function GradientHeader({
  children,
  className = '',
  contentClassName = '',
  style,
  contentStyle,
  expandToFill = false,
}: GradientHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={GRADIENT.PRIMARY_TO_WHITE}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        className={`w-full ${expandToFill ? 'h-full' : ''} ${className}`}
        style={style}
      >
        <View
          className={`w-full ${expandToFill ? 'h-full' : ''} ${contentClassName}`}
          style={[
            contentStyle,
            { paddingTop: insets.top }
          ]}
        >
          {children}
        </View>
      </LinearGradient>
    </>
  );
}
