import React from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { ANIMATION } from '@/constants/animation';

interface StatusBarBackgroundProps {
  opacity: Animated.AnimatedInterpolation<number> | any;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export const StatusBarBackground: React.FC<StatusBarBackgroundProps> = ({
  opacity,
  className = '',
  style
}) => {
  return (
    <Animated.View
      className={`absolute top-0 left-0 right-0 bg-white z-[30] ${className}`}
      style={[
        { height: ANIMATION.STATUS_BAR_HEIGHT, opacity },
        style
      ]}
    />
  );
};