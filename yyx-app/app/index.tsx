import { Redirect } from 'expo-router';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { View } from 'react-native';

export default function Index() {
  const { userProfile, loading: profileLoading } = useUserProfile();

  if (profileLoading) return null;

  // If user exists but onboarding not complete, show modal
  if (!userProfile?.onboardingComplete) {
    return (
      <View style={{ flex: 1 }}>
        <OnboardingModal visible={true} />
      </View>
    );
  }

  // If everything complete, go to main app
  return <Redirect href="/(tabs)/recipes" />;
} 