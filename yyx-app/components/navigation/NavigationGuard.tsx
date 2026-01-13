import React, { useEffect, ReactNode, useCallback } from 'react';
import { useSegments, useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';

interface NavigationGuardProps {
  children: ReactNode;
}

/**
 * NavigationGuard - Controls app navigation flow based on authentication and onboarding status
 * 
 * This component:
 * 1. Prevents unauthenticated users from accessing protected routes
 * 2. Ensures authenticated users complete onboarding before accessing content
 * 3. Handles deep linking and redirects users to appropriate destinations
 */
export function NavigationGuard({ children }: NavigationGuardProps) {
  // Authentication and profile data
  const { user, loading, checkForPendingDeepLink } = useAuth();
  const { userProfile, loading: profileLoading } = useUserProfile();

  // Navigation state
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();

  // Memoized navigation functions
  // Uses router as dependency since the function references router
  const navigateToHome = useCallback(() => {
    router.replace('/');
  }, [router]);

  // Deep link handling
  // Depends on checkForPendingDeepLink and navigateToHome which could change
  const handleAuthenticatedRedirect = useCallback(async () => {
    const hasPendingAuthLink = await checkForPendingDeepLink();
    if (!hasPendingAuthLink) {
      navigateToHome();
    }
  }, [checkForPendingDeepLink, navigateToHome]);

  // Route detection helpers
  const getRouteInfo = useCallback(() => {
    return {
      isAuthRoute: segments[0] === 'auth',
      isNotFoundPage: segments[0] === '+not-found',
      isRootPath: pathname === '/' || pathname === '',
      needsOnboarding: userProfile && !userProfile.onboardingComplete
    };
  }, [segments, pathname, userProfile]);

  // Main navigation effect
  useEffect(() => {
    if (loading || profileLoading) return;

    const { isAuthRoute, isNotFoundPage, isRootPath, needsOnboarding } = getRouteInfo();

    // Handle unauthenticated users
    if (!user) {
      if (!isAuthRoute) {
        router.replace('/auth/signup');
      }
      return;
    }

    // Handle onboarding flow
    if (needsOnboarding && !isRootPath) {
      router.replace('/');
      return;
    }

    // Handle authenticated users in auth routes
    if ((isAuthRoute || isNotFoundPage) && !needsOnboarding) {
      handleAuthenticatedRedirect();
    }
  }, [
    // State that determines navigation conditions
    user,
    loading,
    profileLoading,

    // Functions that may change if their dependencies change
    getRouteInfo,
    router,
    handleAuthenticatedRedirect
  ]);

  if (loading || profileLoading) return null;

  return <>{children}</>;
} 