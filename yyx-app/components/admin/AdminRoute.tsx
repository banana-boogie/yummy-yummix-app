import React, { ReactNode, useEffect } from 'react';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { Redirect, Router, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { COLORS } from '@/constants/design-tokens';

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * A helper function to navigate to a path safely.
 * This is necessary because the router is not always available when the component is mounted.
 * @param router The router object.
 * @param path The path to navigate to.
 */
function safeNavigate(router: Router, path: string) {
  setTimeout(() => {
    router.replace(path as any);
  }, 300);
}

/**
 * A component that protects routes by only allowing admin users to access them.
 * Non-admin users will be redirected to the home page.
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { isAdmin, loading } = useUserProfile();
  const router = useRouter();

  useEffect(() => {
    // If the user is not an admin and the profile has finished loading, redirect to home
    if (!loading && !isAdmin) {
      safeNavigate(router, '/');
    }
  }, [isAdmin, loading, router]);

  // Show loading indicator while determining admin status
  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color={COLORS.primary.DARKEST} />
      </View>
    );
  }

  // If the user is an admin, render the children
  if (isAdmin) {
    return <>{children}</>;
  }

  // By default, redirect to home
  return <Redirect href="/" />;
}
