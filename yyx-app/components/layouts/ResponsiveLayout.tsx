import React, { ReactNode } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { MaxWidthConfig } from './PageLayout';
import { useDevice } from '@/hooks/useDevice';

interface ResponsiveLayoutProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  maxWidth?: number | MaxWidthConfig;
  contentContainerStyle?: StyleProp<ViewStyle>;
  disableMaxWidth?: boolean;
  /**
   * Whether to account for tab bar spacing. Use false if the parent already handles tab bar spacing.
   * Defaults to false because PageLayout typically handles this.
   */
  adjustForTabBar?: boolean;
  /**
   * If true, the container will size to fit its content (flex: 0) instead of expanding to fill space.
   * Useful for headers or auto-height components.
   */
  fitContent?: boolean;
  className?: string;
  contentClassName?: string;
}

/**
 * ResponsiveLayout - Basic responsive layout component
 * 
 * This component automatically adapts content width based on device size:
 * - Mobile: 500px max width
 * - Tablet: 700px max width 
 * - Desktop: 800px max width
 */
export function ResponsiveLayout({
  children,
  style,
  contentContainerStyle,
  maxWidth,
  disableMaxWidth = false,
  adjustForTabBar = false,
  fitContent = false,
  className,
  contentClassName,
}: ResponsiveLayoutProps) {
  const { isPhone, isMedium, isLarge } = useDevice();

  // Determine the appropriate max width based on device size
  let calculatedMaxWidth: number | undefined;

  if (typeof maxWidth === 'number') {
    calculatedMaxWidth = maxWidth;
  } else if (maxWidth && typeof maxWidth === 'object') {
    if (isPhone && maxWidth.smallScreen) {
      calculatedMaxWidth = maxWidth.smallScreen;
    } else if (isMedium && maxWidth.mediumScreen) {
      calculatedMaxWidth = maxWidth.mediumScreen;
    } else if (isLarge && maxWidth.largeScreen) {
      calculatedMaxWidth = maxWidth.largeScreen;
    }
  }

  // Determine if we should apply the default max-widths via tailwind
  const useDefaultMaxWidth = !disableMaxWidth && !calculatedMaxWidth;

  return (
    <View
      className={`
        self-center w-full
        ${fitContent ? 'flex-none' : 'flex-1'}
        ${useDefaultMaxWidth ? 'max-w-[500px] md:max-w-[700px] lg:max-w-[800px]' : ''}
        ${adjustForTabBar ? 'lg:pl-[80px]' : ''}
        ${className || ''}
      `}
      style={[
        calculatedMaxWidth ? { maxWidth: calculatedMaxWidth } : {},
        style
      ]}
    >
      <View
        className={`${fitContent ? 'flex-none' : 'flex-1'} ${contentClassName || ''}`}
        style={contentContainerStyle}
      >
        {children}
      </View>
    </View>
  );
}
