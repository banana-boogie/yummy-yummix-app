import React, { useState } from 'react';
import {
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  View,
  Platform,
  ViewStyle,
  TextStyle,
  StyleProp
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { Text } from '@/components/common/Text';

interface TextInputProps extends RNTextInputProps {
  containerClassName?: string;
  inputClassName?: string;
  className?: string; // Added for RNTextInput itself
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  label?: string;
  error?: string;
  helperText?: string;
  helperTextPosition?: 'left' | 'right';
  rightIcon?: keyof typeof Ionicons.glyphMap;
  leftIcon?: React.ReactNode;
  suffix?: string;
  maxLength?: number;
  showCounter?: boolean;
  numericOnly?: boolean;
  allowDecimal?: boolean;
  required?: boolean;
}

export function TextInput({
  style,
  className = '',
  containerClassName = '',
  containerStyle,
  inputStyle,
  inputClassName = '',
  error,
  label,
  helperText,
  helperTextPosition = 'left',
  rightIcon,
  leftIcon,
  suffix,
  maxLength,
  showCounter = false,
  numericOnly = false,
  allowDecimal = true,
  required = false,
  onChangeText,
  ...props
}: TextInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  // Character counter display
  const textLength = (props.value || '').toString().length;
  const counterText = `${textLength}/${maxLength}`;

  // Handle numeric input validation
  const handleChangeText = (text: string) => {
    if (numericOnly) {
      const pattern = allowDecimal ? /[^0-9.]/g : /[^0-9]/g;
      let sanitizedText = text.replace(pattern, '');

      if (allowDecimal && sanitizedText.split('.').length > 2) {
        const parts = sanitizedText.split('.');
        sanitizedText = parts[0] + '.' + parts.slice(1).join('');
      }

      if (onChangeText) {
        onChangeText(sanitizedText);
      }
    } else if (onChangeText) {
      onChangeText(text);
    }
  };

  return (
    <View className={`w-full ${containerClassName}`} style={containerStyle}>
      {/* Label Row */}
      {label ? (
        <View className="flex-row justify-between items-center pl-xxs mb-xxs">
          <Text className="text-text-default text-sm font-semibold">
            {label} {required ? '*' : ''}
          </Text>
        </View>
      ) : null}

      {/* Input Container */}
      <View className={`
        flex-row items-center bg-background-default rounded-md border-[1.5px] border-border-default
        ${isFocused ? 'border-border-focus' : ''}
        ${error ? 'border-status-error bg-primary-lighter' : ''}
      `}>
        {leftIcon ? <View className="pl-sm">{leftIcon}</View> : null}

        <RNTextInput
          className={`
            mx-sm bg-background-default flex-1 p-md text-text-default text-base
            ${leftIcon ? 'pl-xs' : ''}
            ${suffix ? 'pr-0' : ''}
            ${inputClassName}
            ${className}
          `}
          style={[
            Platform.OS === 'web' ? { outlineWidth: 0 } : {},
            inputStyle,
            style
          ]}
          placeholderTextColor={COLORS.text.secondary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          maxLength={maxLength}
          onChangeText={handleChangeText}
          keyboardType={numericOnly ? 'numeric' : props.keyboardType}
          {...props}
        />

        {suffix ? <Text className="pr-md text-text-secondary">{suffix}</Text> : null}

        {rightIcon ? (
          <View className="p-xs mr-xs">
            <Ionicons
              name={rightIcon}
              size={20}
              color={COLORS.text.secondary}
            />
          </View>
        ) : null}
      </View>

      <View className="flex-row justify-between items-center mt-xxs">
        {error ? (
          <View className="flex-row mt-xxs px-xs items-center">
            <Feather name="alert-circle" size={14} color={COLORS.status.error} />
            <Text preset="caption" className="text-status-error ml-xxs">{error}</Text>
          </View>
        ) : null}

        {helperText ? (
          <Text
            preset="caption"
            className={`text-text-secondary mt-xxs px-xs ${helperTextPosition === 'right' ? 'ml-auto' : 'mr-auto'}`}
          >
            {helperText}
          </Text>
        ) : null}

        {/* Character Counter */}
        {showCounter ? (
          <Text preset="caption" className="text-text-secondary ml-auto mr-xxs">{counterText}</Text>
        ) : null}
      </View>
    </View>
  );
}
