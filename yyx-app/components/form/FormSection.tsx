import React, { ReactNode } from 'react';
import { View, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { ErrorMessage } from '../common/ErrorMessage';
import { COLORS, SPACING, FONT_SIZES } from '@/constants/design-tokens';

// Export the maximum width for forms so it can be reused
export const FORM_MAX_WIDTH = 800;

type HeaderVariant = 'default' | 'prominent';

/**
 * Visual treatment per header variant. One source of truth instead of a
 * ternary per style property sprinkled across the JSX.
 */
const VARIANT_CONFIG = {
  default: {
    // Outer card chrome — the non-prominent variant is a bare container.
    containerClass: '',
    // Title row
    titleMarginClass: 'mb-sm',
    accentBarWidth: 3,
    accentBarColor: COLORS.primary.medium,
    accentBarPaddingLeft: SPACING.sm,
    // Title text
    titlePreset: 'subheading' as const,
    titleClass: '',
    titleFontSize: FONT_SIZES['2xl'] as number | undefined,
  },
  prominent: {
    containerClass:
      'rounded-lg bg-background-default border border-grey-default p-xl',
    titleMarginClass: 'mb-lg',
    accentBarWidth: 5,
    accentBarColor: COLORS.primary.dark,
    accentBarPaddingLeft: SPACING.md,
    titlePreset: 'h2' as const,
    titleClass: 'font-bold text-text-default',
    // h2 preset already sets font size; don't override.
    titleFontSize: undefined as number | undefined,
  },
} satisfies Record<HeaderVariant, unknown>;

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
   * - 'default': subheading title, 3px accent bar, compact spacing.
   * - 'prominent': h2 title, 5px accent bar, containerized card with padding
   *   and border. Used for admin wizard steps where section hierarchy should
   *   read more strongly.
   */
  headerVariant?: HeaderVariant;
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
  const variant = VARIANT_CONFIG[headerVariant];
  return (
    <View
      className={`w-full ${className} ${variant.containerClass}`}
      style={[{ maxWidth }, style]}
    >
      {title ? (
        <View
          style={{
            borderLeftWidth: variant.accentBarWidth,
            borderLeftColor: variant.accentBarColor,
            paddingLeft: variant.accentBarPaddingLeft,
          }}
          className={variant.titleMarginClass}
        >
          <Text
            preset={variant.titlePreset}
            className={variant.titleClass}
            style={[
              variant.titleFontSize != null
                ? { fontSize: variant.titleFontSize }
                : undefined,
              titleStyle,
            ]}
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
