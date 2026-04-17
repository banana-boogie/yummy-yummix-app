import React, { ReactNode, isValidElement, cloneElement } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { InfoTooltip } from '@/components/common/InfoTooltip';

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
    <View className={className} style={style}>
      {label ? (
        <View className="flex-row items-center gap-xxs mb-sm">
          <Text className="flex-shrink text-base text-text-default font-semibold">
            {label}
            {required ? (
              <Text className="text-status-error"> *</Text>
            ) : null}
          </Text>
          {helperText ? <InfoTooltip content={helperText} /> : null}
        </View>
      ) : null}

      {enhancedChildren}

      {error ? (
        <Text className="text-status-error text-sm mt-xs">{error}</Text>
      ) : null}
    </View>
  );
}
