import { Redirect, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '@/constants/design-tokens';

/**
 * Root index — the single auth entry point.
 * Only redirects when this screen is actually the focused destination.
 * On web refresh at deep routes (e.g. /admin/recipes), Expo Router may
 * render this screen briefly — we show a spinner instead of redirecting.
 */
export default function Index() {
  const { user, loading } = useAuth();
  const { userProfile, loading: profileLoading } = useUserProfile();
  const segments = useSegments();

  // If segments indicate we're not actually on the root index,
  // don't redirect — another screen is the real destination.
  const isRootScreen = segments.length === 0 || (segments.length === 1 && segments[0] === '');
  console.log('[Index]', { segments: segments.join('/'), isRootScreen, loading, profileLoading, user: !!user });

  // Show loading while auth or profile resolves
  if (loading || profileLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary.darkest} />
      </View>
    );
  }

  // Not logged in → auth (always redirect, even from deep routes)
  if (!user) return <Redirect href="/auth/signup" />;

  // Only redirect authenticated users if this is actually the root screen
  if (!isRootScreen) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary.darkest} />
      </View>
    );
  }

  // Needs onboarding → show modal
  if (!userProfile?.onboardingComplete) {
    return (
      <View style={{ flex: 1 }}>
        <OnboardingModal visible={true} />
      </View>
    );
  }

  // All good → main app
  return <Redirect href="/(tabs)/chat" />;
}
