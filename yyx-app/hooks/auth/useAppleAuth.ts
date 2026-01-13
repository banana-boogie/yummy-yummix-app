import { useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
import i18n from '@/i18n';
import { Platform } from 'react-native';
import { useOnboarding } from '@/contexts/OnboardingContext';

export function useAppleAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { updateFormData } = useOnboarding();

  // Extract full name from Apple credentials
  const extractFullName = (fullName: AppleAuthentication.AppleAuthenticationFullName | null): string => {
    if (!fullName) return '';

    // First priority: givenName
    if (fullName.givenName) {
      // If we have both given name and family name
      if (fullName.familyName) {
        return `${fullName.givenName} ${fullName.familyName}`.trim();
      }
      // Just given name
      return fullName.givenName.trim();
    }
    
    // Second priority: combination of names
    const nameParts = [
      fullName.namePrefix,
      fullName.givenName,
      fullName.middleName,
      fullName.familyName,
      fullName.nameSuffix
    ].filter(Boolean);
    
    if (nameParts.length > 0) {
      return nameParts.join(' ').trim();
    }
    
    // Last resort: nickname
    if (fullName.nickname) {
      return fullName.nickname.trim();
    }
    
    return '';
  };

  // Handle web-based Apple authentication
  const handleWebAppleSignIn = async () => {
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
    });

    if (signInError) {
      throw signInError;
    }
  };

  // Handle native iOS Apple authentication
  const handleNativeAppleSignIn = async () => {
    // Check if Apple authentication is available on the device
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      throw new Error(i18n.t('auth.appleAuth.appleAuthNotAvailable'));
    }

    try {
      // Request Apple authentication
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('No identity token returned from Apple');
      }

      // Sign in with Supabase using the Apple ID token
      const { data, error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (signInError) {
        throw signInError;
      }

      // Process user's name if provided by Apple
      if (credential.fullName) {
        const fullName = extractFullName(credential.fullName);
        // Update the onboarding context with the name instead of the profile
        if (fullName && data?.user) {
          updateFormData({ name: fullName });
        }
      }

      return data;
    } catch (error: any) {
      // Handle specific Apple authentication errors
      if (error.code === 'ERR_REQUEST_CANCELED') {
        throw new Error(i18n.t('auth.appleAuth.loginCancelled'));
      }
      throw error;
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Call the appropriate sign-in method based on platform
      if (Platform.OS === 'ios') {
        await handleNativeAppleSignIn();
      } else {
        await handleWebAppleSignIn();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err);
      } else {
        setError(new Error(String(err)));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    handleAppleSignIn,
  };
} 
