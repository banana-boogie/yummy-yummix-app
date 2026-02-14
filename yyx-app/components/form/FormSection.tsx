import React, { ReactNode } from 'react';
import { View, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { ErrorMessage } from '../common/ErrorMessage';
import { COLORS, SPACING, FONT_SIZES } from '@/constants/design-tokens';

// Export the maximum width for forms so it can be reused
export const FORM_MAX_WIDTH = 800;

interface FormSectionProps {
  children: ReactNode;
  title?: string;
  description?: string;
  error?: string;
  maxWidth?: number;
  titleStyle?: TextStyle;
  className?: string; // Add className support
  style?: StyleProp<ViewStyle>;
}

export function FormSection({
  title,
  children,
  maxWidth = FORM_MAX_WIDTH,
  titleStyle,
  className = '',
  style,
  description,
  error
}: FormSectionProps) {
  return (
    <View
      className={`mb-lg rounded-sm w-full ${className}`}
      style={[{ maxWidth, backgroundColor: 'transparent', paddingHorizontal: SPACING.md, borderWidth: 0 }, style]}
    >
      {title ? (
        <>
          <View className="border-t border-grey-default mb-lg" />
          <View style={{ borderLeftWidth: 3, borderLeftColor: COLORS.primary.medium, paddingLeft: SPACING.sm }} className="mb-xl">
            <Text preset="subheading" style={[{ fontSize: FONT_SIZES['2xl'] }, titleStyle]}>
              {title}
            </Text>
          </View>
        </>
      ) : null}
      {description ? (
        <Text preset="body" className="mb-md">
          {description}
        </Text>
      ) : null}
      {error ? (
        <View className="mb-md">
          <ErrorMessage message={error} />
        </View>
      ) : null}
      {children}
    </View>
  );
}
