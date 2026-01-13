import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';

interface AuthFooterProps {
  message: string;
  linkText: string;
  onLinkPress: () => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function AuthFooter({ message, linkText, onLinkPress, className = '', style }: AuthFooterProps) {
  return (
    <View className={`mt-auto items-center mb-xl ${className}`} style={style}>
      <Text preset="body" className="mb-xxxl text-text-secondary">
        {message}{' '}
        <Text preset="link" onPress={onLinkPress}>
          {linkText}
        </Text>
      </Text>
    </View>
  );
}