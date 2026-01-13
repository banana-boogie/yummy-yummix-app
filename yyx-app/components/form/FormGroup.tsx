import React, { ReactNode } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';

interface FormGroupProps {
  label?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  helperText?: string;
  className?: string; // Add className support
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
  return (
    <View className={`flex-1 mb-md ${className}`} style={style}>
      {label ? (
        <Text className="text-xs text-text-default mb-xxs">
          {label} {required ? '*' : null}
        </Text>
      ) : null}

      {helperText ? (
        <Text className="text-sm text-text-secondary mb-sm">{helperText}</Text>
      ) : null}

      {children}

      {error ? (
        <Text className="text-status-error text-sm mt-xs">{error}</Text>
      ) : null}
    </View>
  );
}
