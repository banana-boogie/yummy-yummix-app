import React, { ReactElement } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, View, ImageSourcePropType, Pressable, } from 'react-native';
import { Text } from './Text';
import { COLORS } from '@/constants/design-tokens';
import { useDevice } from '@/hooks/useDevice';

interface ButtonProps {
  onPress: () => void;
  label?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'flat';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  textClassName?: string;
  iconClassName?: string;
  rightIconClassName?: string;
  style?: any;
  textStyle?: any;
  icon?: ImageSourcePropType | ReactElement;
  rightIcon?: ImageSourcePropType | ReactElement;
  children?: React.ReactNode;
  backgroundColor?: string;
  textColor?: string;
  fontWeight?: string;
  fullWidth?: boolean;
  accessibilityLabel?: string;
}

export function Button({
  onPress,
  label,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  children,
  icon,
  rightIcon,
  className = '',
  textClassName = '',
  iconClassName = '',
  rightIconClassName = '',
  style,
  textStyle,
  backgroundColor,
  textColor,
  fontWeight: initialFontWeight,
  fullWidth = false,
  accessibilityLabel,
}: ButtonProps) {
  const { isPhone } = useDevice();

  // Base button classes
  const baseButtonClass = "flex-row items-center justify-center rounded-[35px] shadow-md";

  // Variant button classes
  const variantButtonClasses = {
    primary: "bg-primary-medium",
    secondary: "bg-background-secondary",
    outline: "bg-neutral-white border-[1.5px] border-grey-medium shadow-md",
    flat: "bg-transparent border border-grey-medium rounded-md shadow-md",
  };

  // Size button classes
  const sizeButtonClasses = {
    small: "py-2 px-4",
    medium: "py-md px-xl",
    large: "py-lg px-xxxl",
  };

  // State classes
  const stateClasses = `
    ${disabled || loading ? 'opacity-50' : 'active:opacity-85 active:scale-[0.98]'}
    ${fullWidth ? 'self-stretch w-full' : ''}
`;

  // Base text classes
  const baseTextClass = "text-center";

  // Variant text classes
  const variantTextClasses = {
    primary: "text-grey-dark",
    secondary: "text-text-default",
    outline: "text-text-default",
    flat: "text-text-default",
  };

  // Size text classes (for font-weight only, fontSize handled via inline style)
  // Note: We use font-medium as default for all sizes. Use fontWeight prop for bold.
  const sizeTextClasses = {
    small: "font-medium",
    medium: "font-medium",
    large: "font-medium",
  };

  // Font sizes for each button size (passed as inline style to override preset)
  const sizeFontSizes = {
    small: 16,  // text-base
    medium: 18, // text-md
    large: 20,  // text-lg (was 24/text-xl, reduced by one level)
  };

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return <View className={`justify-center items-center mr-xxs ${iconClassName}`}>{icon}</View>;
    }
    return (
      <Image
        source={icon as ImageSourcePropType}
        className={`w-5 h-5 mx-xxs ${iconClassName}`}
        contentFit="contain"
        cachePolicy="memory-disk"
      />
    );
  };

  const renderRightIcon = () => {
    if (!rightIcon) return null;
    if (React.isValidElement(rightIcon)) {
      return <View className={`justify-center items-center ml-xxs ${rightIconClassName}`}>{rightIcon}</View>;
    }
    return (
      <Image
        source={rightIcon as ImageSourcePropType}
        className={`w-5 h-5 mx-xxs ${rightIconClassName}`}
        contentFit="contain"
        cachePolicy="memory-disk"
      />
    );
  };

  const content = loading ? (
    <ActivityIndicator color={COLORS.primary.dark} />
  ) : (
    <View className="flex-row items-center justify-center flex-shrink-0">
      {renderIcon()}
      {(label || children) && (
        <Text
          fontWeight={initialFontWeight as any}
          className={`
            ${baseTextClass}
            ${variantTextClasses[variant]}
            ${disabled ? 'text-text-secondary' : ''}
            ${sizeTextClasses[size]}
            ${textClassName}
            flex-shrink-0
          `}
          style={[
            { fontSize: sizeFontSizes[size] },
            textColor ? { color: textColor } : undefined,
            textStyle
          ]}
        >
          {label || children}
        </Text>
      )}
      {renderRightIcon()}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      className={`
        ${baseButtonClass}
        ${variantButtonClasses[variant]}
        ${sizeButtonClasses[size]}
        ${stateClasses}
        ${className}
      `}
      style={[
        backgroundColor ? { backgroundColor } : undefined,
        style
      ]}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      accessibilityLabel={accessibilityLabel || label}
    >
      {content}
    </Pressable>
  );
}