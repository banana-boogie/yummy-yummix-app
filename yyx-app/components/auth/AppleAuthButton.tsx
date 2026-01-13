import React from 'react';
import { Button } from '@/components/common/Button';
import i18n from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import { StyleProp, ViewStyle } from 'react-native';

interface AppleAuthButtonProps {
  onPress: () => Promise<void>;
  isLoading?: boolean;
  isSignUp?: boolean;
  className?: string; // Add className
  style?: StyleProp<ViewStyle>;
}

export function AppleAuthButton({ onPress, isLoading = false, isSignUp = false, className = '', style }: AppleAuthButtonProps) {
  // Get the appropriate translated text based on isSignUp prop
  const buttonLabel = isSignUp
    ? i18n.t('auth.appleAuth.signup')
    : i18n.t('auth.appleAuth.login');

  return (
    <Button
      label={buttonLabel}
      onPress={onPress}
      icon={<Ionicons name="logo-apple" size={24} className="text-text-default mr-xs" />}
      loading={isLoading}
      variant="outline"
      className={`bg-background-default border border-grey-medium ${className}`}
      textClassName="text-text-default"
      style={style}
    />
  );
}