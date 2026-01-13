import { Text as RNText, TextStyle, StyleSheet, StyleProp } from 'react-native';
import { FONTS, FONT_SIZES, FONT_WEIGHTS, TEXT_PRESETS, TextPreset } from '@/constants/design-tokens';
import { useDevice } from '@/hooks/useDevice';

/**
 * Text component that uses predefined presets for consistent typography.
 * 
 * Available presets: see TEXT_PRESETS in constants/typography.ts for more details
 */
interface TextProps {
  // Core props
  preset?: TextPreset;
  children: React.ReactNode;

  // Style overrides
  color?: string;
  fontSize?: number;
  fontWeight?: keyof typeof FONT_WEIGHTS | (typeof FONT_WEIGHTS)[keyof typeof FONT_WEIGHTS];
  italic?: boolean;
  style?: StyleProp<TextStyle>;
  className?: string;

  // Layout
  align?: 'left' | 'center' | 'right';
  marginBottom?: number;

  // Behavior
  onPress?: () => void;
  numberOfLines?: number;
}

export function Text({
  // Use body as the default preset
  preset = 'body',
  children,

  // Style overrides
  color,
  fontSize,
  fontWeight,
  italic,
  style,
  className,

  // Layout
  align,
  marginBottom,

  // Behavior
  onPress,
  numberOfLines,
  ...props
}: TextProps) {
  const { isPhone, isMedium } = useDevice();

  // Get the base preset style
  const basePresetStyle = TEXT_PRESETS[preset];

  // Simple responsive scaling for font size if not using NativeWind classes
  const scale = isPhone ? 1.0 : isMedium ? 1.0 : 1.1;

  // Determine the weight: prop wins, then className (implicitly via style precedence), then preset.
  // To allow className to win over the preset, we only add the preset weight if no font-weight class is present.
  const hasInlinedWeight = className?.match(/\bfont-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/);
  const hasInlinedSize = className?.match(/\btext-(xs|sm|base|md|lg|xl|2xl|3xl|4xl|5xl|6xl|\[.*?\])\b/);

  // Determine the weight and size: props win, then className, then preset.
  const finalFontSize = fontSize || (hasInlinedSize ? undefined : basePresetStyle.fontSize);
  const finalFontWeight = fontWeight || (hasInlinedWeight ? undefined : basePresetStyle.fontWeight);

  // Create a clean base style from the preset
  const baseStyle: TextStyle = {
    fontFamily: basePresetStyle.fontFamily,
    color: color || basePresetStyle.color,
  };

  // Only add these to the style object if we have a value. 
  // If we don't, we leave the key out so NativeWind classes can inject their own values.
  if (finalFontSize) {
    baseStyle.fontSize = finalFontSize * scale;
  }

  if (finalFontWeight) {
    baseStyle.fontWeight = (FONT_WEIGHTS[finalFontWeight as keyof typeof FONT_WEIGHTS] || finalFontWeight) as any;
  }

  if (basePresetStyle.textDecorationLine) {
    baseStyle.textDecorationLine = basePresetStyle.textDecorationLine as any;
  }

  const styleOverrides: TextStyle = {};
  if (italic) styleOverrides.fontStyle = 'italic';
  if (align) styleOverrides.textAlign = align;
  if (marginBottom !== undefined) styleOverrides.marginBottom = marginBottom;

  const combinedStyle = StyleSheet.flatten([
    baseStyle,
    styleOverrides,
    style,
  ]);

  return (
    <RNText
      className={className}
      style={combinedStyle}
      onPress={onPress}
      numberOfLines={numberOfLines}
      {...props}
    >
      {children}
    </RNText>
  );
}
