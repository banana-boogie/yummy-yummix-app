import React, { ReactNode, isValidElement, cloneElement } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';

interface FormGroupProps {
  label?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  helperText?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function FormGroup({
  label,
  required = false,
  error,
  children,
  helperText,
  className = '',
  style
}: FormGroupProps) {
  // Pass hasError prop to child input so it shows error styling (red border)
  // without duplicating the error message (FormGroup already shows it)
  const enhancedChildren = error && isValidElement(children)
    ? cloneElement(children as React.ReactElement<any>, { hasError: true })
    : children;

  return (
    <View className={`flex-1 ${className}`} style={style}>
      {label ? (
        <Text className="text-base text-text-default mb-xs">
          {label} {required ? '*' : null}
        </Text>
      ) : null}

      {helperText ? (
        <Text className="text-sm text-text-secondary mb-sm">{helperText}</Text>
      ) : null}

      {enhancedChildren}

      {error ? (
        <Text className="text-status-error text-sm mt-xs">{error}</Text>
      ) : null}
    </View>
  );
}
