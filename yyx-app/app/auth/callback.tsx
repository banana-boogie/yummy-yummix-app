import { View, ActivityIndicator } from 'react-native';
import { Text } from '@/components/common/Text';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';

export default function AuthCallback() {
  const {
    session,
    loading,
    createSessionFromUrl,
    navigateToHome,
    navigateToInvalidLink,
  } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      if (Platform.OS !== 'web') {
        return;
      }

      // If we already have a session, just navigate home
      if (session) {
        navigateToHome();
        return;
      }

      // No session yet, try to create one from the URL
      try {
        // Log the complete URL that brought us to this page
        const currentUrl = window.location.href;

        const newSession = await createSessionFromUrl(currentUrl);

        if (newSession) {
          navigateToHome();
        } else {
          // Check if auth state was changed despite the apparent failure
          const { data } = await supabase.auth.getSession();

          if (data.session) {
            navigateToHome();
          } else {
            navigateToInvalidLink();
          }
        }
      } catch (error) {
        // Check if we have a session despite the error
        const { data } = await supabase.auth.getSession();

        if (data.session) {
          navigateToHome();
        } else {
          navigateToInvalidLink();
        }
      }
    };

    // Don't attempt to handle the callback until loading is complete
    if (!loading) {
      handleCallback();
    }
  }, [session, loading]);

  return (
    <View className="flex-1 justify-center items-center p-lg">
      <ActivityIndicator size="large" color="#10b981" />
      <Text className="mt-md text-md text-center">{i18n.t('auth.processing') || 'Processing login...'}</Text>
    </View>
  );
}