import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useDevice } from '@/hooks/useDevice';

type LayoutType = 'row' | 'column';

interface ResponsiveColumnLayoutProps {
  children: React.ReactNode;
  smallScreenLayout?: LayoutType;
  largeScreenLayout?: LayoutType;
  smallScreenContent?: React.ReactNode;
  largeScreenContent?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

/**
 * A component that handles responsive layouts based on screen size.
 */
export const ResponsiveColumnLayout: React.FC<ResponsiveColumnLayoutProps> = ({
  children,
  smallScreenLayout = 'column',
  largeScreenLayout = 'row',
  smallScreenContent,
  largeScreenContent,
  style,
  className = ''
}) => {
  const { isPhone } = useDevice();

  // If different content is provided for different screen sizes
  if (smallScreenContent && largeScreenContent) {
    return (
      <View className={`w-full ${className}`} style={style}>
        {isPhone ? smallScreenContent : largeScreenContent}
      </View>
    );
  }

  const flexDirectionClass = isPhone
    ? (smallScreenLayout === 'row' ? 'flex-row' : 'flex-col')
    : (largeScreenLayout === 'row' ? 'flex-row' : 'flex-col');

  const justifyContentClass = isPhone ? 'justify-start' : 'justify-between';

  return (
    <View
      className={`w-full ${flexDirectionClass} ${justifyContentClass} ${className}`}
      style={style}
    >
      {children}
    </View>
  );
};

/**
 * A component for the main content column in a responsive layout
 */
export const MainColumn: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; className?: string }> = ({
  children,
  style,
  className = ''
}) => {
  const { isPhone } = useDevice();

  if (isPhone) {
    return <>{children}</>;
  }

  return (
    <View className={`flex-[2] ${className}`} style={style}>
      {children}
    </View>
  );
};

/**
 * A component for the side column in a responsive layout
 */
export const SideColumn: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; className?: string }> = ({
  children,
  style,
  className = ''
}) => {
  const { isPhone } = useDevice();

  if (isPhone) {
    return <>{children}</>;
  }

  return (
    <View className={`flex-1 ${className}`} style={style}>
      {children}
    </View>
  );
};
