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
  /**
   * Header visual treatment.
   * - 'default': subheading title, 3px accent bar, compact spacing (existing behavior).
   * - 'prominent': h3 title, 4px accent bar, bottom divider, generous spacing to content.
   *   Use for admin wizard steps where section hierarchy should read more strongly.
   */
  headerVariant?: 'default' | 'prominent';
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
  error,
  headerVariant = 'default',
}: FormSectionProps) {
  const isProminent = headerVariant === 'prominent';
  return (
    <View
      className={`w-full ${className} ${isProminent ? 'rounded-lg bg-background-default border border-grey-default p-xl' : ''}`}
      style={[{ maxWidth }, style]}
    >
      {title ? (
        <View
          style={{
            borderLeftWidth: isProminent ? 5 : 3,
            borderLeftColor: isProminent ? COLORS.primary.dark : COLORS.primary.medium,
            paddingLeft: isProminent ? SPACING.md : SPACING.sm,
          }}
          className={isProminent ? 'mb-lg' : 'mb-sm'}
        >
          <Text
            preset={isProminent ? 'h2' : 'subheading'}
            className={isProminent ? 'font-bold text-text-default' : ''}
            style={[isProminent ? undefined : { fontSize: FONT_SIZES['2xl'] }, titleStyle]}
          >
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
