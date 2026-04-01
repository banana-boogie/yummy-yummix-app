import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '@/constants/design-tokens';

export default function Index() {
  const { user, loading } = useAuth();
  const { userProfile, loading: profileLoading } = useUserProfile();

  if (loading || profileLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary.darkest} />
      </View>
    );
  }

  if (!user) return <Redirect href="/auth/signup" />;

  if (!userProfile?.onboardingComplete) {
    return (
      <View style={{ flex: 1 }}>
        <OnboardingModal visible={true} />
      </View>
    );
  }

  return <Redirect href="/(tabs)/chat" />;
}
