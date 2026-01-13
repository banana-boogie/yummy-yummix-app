import { useState, useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import i18n from '@/i18n';
import { getAuthErrorKey, AuthErrorKey } from '@/utils/supabase/authErrors';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';
import { AuthError } from '@supabase/supabase-js';

export function useMagicLink() {
  const params = useLocalSearchParams<{ 
    email?: string;
    error?: string;
  }>();
  const [email, setEmail] = useState(params.email || '');
  const [isEmailValid, setIsEmailValid] = useState(!!params.email);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ message: string } | null>(null);
  const [showEmailSent, setShowEmailSent] = useState(false);

  // Handle error from invalid/expired link
  useEffect(() => {
    if (params.error === 'invalid') {
      setError({ 
        message: i18n.t('auth.emailAuth.confirmation.errors.invalid')
      });
    }
  }, [params.error]);

  const loginWithMagicLink = async (email: string) => {
    try {
      // Get the base redirect URI
      const baseRedirectUri = makeRedirectUri();

      // Configure the redirect URL based on platform and environment
      const redirectTo = Platform.select({
        web: `${baseRedirectUri}/auth/callback`,
        native: __DEV__ && baseRedirectUri.startsWith('exp://')
          ? `${baseRedirectUri}/--/auth/callback`  // Expo Go development
          : `${baseRedirectUri}auth/callback`     // Production mobile app
      });
      

      // Send magic link
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          data: { language: i18n.locale }
        },
      });

      if (error) {
        console.error('🔗 Magic Link Flow - Error sending magic link:', error);
      } else {
      }

      return { error };
    } catch (error) {
      console.error('🔗 Magic Link Flow - Error in loginWithMagicLink:', error);
      return { error: error as AuthError };
    }
  };

  const handleMagicLink = async () => {
    if (!email || !isEmailValid) {
      setError({ message: i18n.t('auth.errors.invalidEmail') });
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const { error: loginError } = await loginWithMagicLink(email);

      if (!loginError) {
        setShowEmailSent(true);
        return;
      }

      const errorKey = getAuthErrorKey(loginError.code);
      if (errorKey === AuthErrorKey.TooManyAttempts) {
        setShowEmailSent(true);
        return;
      }

      setError({ message: i18n.t(`auth.errors.${errorKey}`) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEmail = async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('message://');
      } else {
        try {
          await Linking.openURL('googlegmail://');
        } catch {
          await Linking.openURL('mailto:');
        }
      }
    } catch (error) {
      console.error('Error opening email app:', error);
    }
  };

  return {
    email,
    setEmail,
    isEmailValid,
    setIsEmailValid,
    isLoading,
    error,
    showEmailSent,
    setShowEmailSent,
    handleMagicLink,
    handleOpenEmail,
  };
} 