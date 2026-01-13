import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';

interface FormErrorsProps {
  errors: Record<string, string>;
  className?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const FormErrors: React.FC<FormErrorsProps> = ({ errors, className = '', containerStyle }) => {
  if (Object.keys(errors).length === 0) {
    return null;
  }

  return (
    <View
      className={`p-md bg-background rounded-lg border border-status-error mb-md ${className}`}
      style={containerStyle}
    >
      {Object.entries(errors).map(([key, error]) => (
        <Text key={key} className="text-status-error mb-xs">
          {error}
        </Text>
      ))}
    </View>
  );
};