import React, { ReactNode } from 'react';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * Content gate for admin routes. No redirects — just shows/hides content.
 * Authentication is handled by index.tsx.
 * This component only checks authorization (is the user an admin?).
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { isAdmin, loading } = useUserProfile();

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color={COLORS.primary.darkest} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View className="flex-1 justify-center items-center p-lg">
        <Text preset="h2" className="text-text-default mb-sm">Access Denied</Text>
        <Text preset="body" className="text-text-secondary text-center">
          You don&apos;t have permission to access this page.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}
