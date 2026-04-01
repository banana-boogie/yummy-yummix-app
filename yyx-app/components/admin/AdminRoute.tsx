import React, { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { Link } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * Content gate for admin routes. No redirects — just shows/hides content.
 * Distinguishes unauthenticated users (shows login prompt) from
 * authenticated non-admin users (shows access denied).
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: profileLoading } = useUserProfile();

  if (authLoading || profileLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color={COLORS.primary.darkest} />
      </View>
    );
  }

  if (!user) {
    return (
      <View className="flex-1 justify-center items-center p-lg">
        <Text preset="h2" className="text-text-default mb-sm">
          {i18n.t('admin.common.loginRequired', { defaultValue: 'Please Log In' })}
        </Text>
        <Text preset="body" className="text-text-secondary text-center mb-lg">
          {i18n.t('admin.common.loginRequiredMessage', { defaultValue: 'You need to be logged in to access this page.' })}
        </Text>
        <Link href="/auth/signup" className="text-primary-dark font-semibold">
          {i18n.t('admin.common.goToLogin', { defaultValue: 'Go to Login' })}
        </Link>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View className="flex-1 justify-center items-center p-lg">
        <Text preset="h2" className="text-text-default mb-sm">
          {i18n.t('admin.common.accessDenied', { defaultValue: 'Access Denied' })}
        </Text>
        <Text preset="body" className="text-text-secondary text-center">
          {i18n.t('admin.common.accessDeniedMessage', { defaultValue: "You don't have permission to access this page." })}
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}
