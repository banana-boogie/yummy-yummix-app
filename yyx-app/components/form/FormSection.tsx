import React, { ReactNode } from 'react';
import { View, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { ErrorMessage } from '../common/ErrorMessage';

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
      className={`mb-md rounded-sm w-full ${className}`}
      style={[{ maxWidth, backgroundColor: 'transparent', paddingHorizontal: 16, borderWidth: 0 }, style]}
    >
      <Text preset="h1" className="mb-md" style={titleStyle}>
        {title}
      </Text>
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
