import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';

interface AuthErrorProps {
  message: string;
  action?: {
    message: string;
    linkText: string;
    onPress: () => void;
  };
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function AuthError({ message, action, className = '', style }: AuthErrorProps) {
  return (
    <View className={`rounded-sm p-md bg-status-error/10 mb-md ${className}`} style={style}>
      <Text
        preset="caption"
        className="text-status-error"
      >
        {message}
      </Text>
      {action && (
        <Text preset="caption" className="mt-xs">
          {action.message}{'\n'}
          <Text preset="link" onPress={action.onPress}>
            {action.linkText}
          </Text>
        </Text>
      )}
    </View>
  );
}