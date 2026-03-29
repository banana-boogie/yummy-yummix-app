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
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * FormSection — structural container for form groups.
 *
 * Owns: internal structure (title bar, description, error).
 * Does NOT own: spacing between siblings — parent controls that via className or gap.
 */
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
      className={`w-full ${className}`}
      style={[{ maxWidth }, style]}
    >
      {title ? (
        <View style={{ borderLeftWidth: 3, borderLeftColor: COLORS.primary.medium, paddingLeft: SPACING.sm }} className="mb-sm">
          <Text preset="subheading" style={[{ fontSize: FONT_SIZES['2xl'] }, titleStyle]}>
            {title}
          </Text>
        </View>
      ) : null}
      {description ? (
        <Text preset="body" className="mb-sm">
          {description}
        </Text>
      ) : null}
      {error ? (
        <View className="mb-sm">
          <ErrorMessage message={error} />
        </View>
      ) : null}
      {children}
    </View>
  );
}
