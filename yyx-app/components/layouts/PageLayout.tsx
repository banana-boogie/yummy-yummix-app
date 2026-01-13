import React, { ReactNode } from 'react';
import { View, ViewStyle, StyleProp, ScrollView } from 'react-native';
import { ResponsiveLayout } from '@/components/layouts/ResponsiveLayout';
import { COLORS } from '@/constants/design-tokens';

// Define a type for the max width configuration
export type MaxWidthConfig = {
  smallScreen?: number;  // Mobile phones
  mediumScreen?: number; // Tablets
  largeScreen?: number;  // Desktops/large tablets
};


interface PageLayoutProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  maxWidth?: number | MaxWidthConfig;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  contentPaddingHorizontal?: number;
  adjustForTabBar?: boolean;
  disableMaxWidth?: boolean;
  scrollEnabled?: boolean;
}

/**
 * PageLayout - A layout component that handles both full-width headers and constrained content
 */
export function PageLayout({
  children,
  header,
  footer,
  maxWidth,
  style,
  contentContainerStyle,
  contentPaddingHorizontal,
  backgroundColor = COLORS.background.default,
  adjustForTabBar = true,
  disableMaxWidth = false,
  scrollEnabled = false,
}: PageLayoutProps) {
  // Content component is either ScrollView or View based on scrollEnabled prop
  const ContentWrapper = scrollEnabled ? ScrollView : View;

  return (
    <View
      className={`flex-1 flex-col ${adjustForTabBar ? 'lg:pl-[80px]' : ''}`}
      style={[{ backgroundColor }, style]}
    >
      {/* Header */}
      {header && <View className="w-full z-[1]">{header}</View>}

      {/* Content area - either scrollable or fixed */}
      <ContentWrapper
        className="flex-1 w-full"
        contentContainerStyle={scrollEnabled ? { flexGrow: 1 } : undefined}
      >
        <ResponsiveLayout
          disableMaxWidth={disableMaxWidth}
          maxWidth={maxWidth}
          className={`flex-1 ${contentPaddingHorizontal === undefined ? 'px-sm' : ''}`}
          style={[
            contentPaddingHorizontal !== undefined ? { paddingHorizontal: contentPaddingHorizontal } : {},
            contentContainerStyle
          ]}
        >
          {children}
        </ResponsiveLayout>
      </ContentWrapper>

      {/* Footer */}
      {footer && <View className="w-full">{footer}</View>}
    </View>
  );
}
