import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { AppState, Linking, Platform } from 'react-native';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { useRouter } from 'expo-router';
import { Storage } from '@/utils/storage';
import { queryClient } from '@/lib/queryClient';
import { userProfileKeys } from '@/lib/queryKeys';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  createSessionFromUrl: (url: string) => Promise<Session | null | undefined>;
  navigateToHome: () => void;
  navigateToInvalidLink: () => void;
  handleDeepLink: (url: string) => boolean;
  checkForPendingDeepLink: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Initialize session state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Handle all deep linking (auth and non-auth)
    const subscription = Linking.addEventListener('url', async ({ url }) => {
      await processIncomingUrl(url);
    });

    // Handle initial URL for all types of links
    Linking.getInitialURL().then(async (url) => {
      if (url) {
        await processIncomingUrl(url);
      }
    });

    // Keep auth state in sync with Supabase
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const didLogIn = !user && session?.user;

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // If user just logged in, check for pending deep links
      if (didLogIn) {
        checkAndProcessPendingDeepLinks();
      }
    });

    // Manage session refresh when app goes to background/foreground
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    // Clean up all subscriptions on unmount
    return () => {
      subscription.remove();
      authSubscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  const navigateToHome = () => {
    setTimeout(() => {
      router.replace('/');
    }, 300);
  };

  const navigateToInvalidLink = () => {
    setTimeout(() => {
      router.replace('/auth/invalid-link');
    }, 300);
  };

  const navigateToRecipe = (id: string) => {
    setTimeout(() => {
      router.replace({
        pathname: "/(tabs)/recipes/[id]",
        params: { id }
      });
    }, 300);
  };

  // Handle a deep link by extracting the route information
  const handleDeepLink = (url: string) => {
    try {
      // Skip handling if this is an auth callback URL - those are handled separately
      if (url.includes('/auth/callback')) {
        return false;
      }

      const { pathname } = new URL(url);

      // Handle recipe preview API links
      if (pathname.includes('/api/recipe-preview/')) {
        const segments = pathname.split('/');
        const id = segments[segments.length - 1];

        if (id) {
          navigateToRecipe(id);
          return true;
        }
      }

      // Handle regular recipes deep links
      if (pathname.includes('recipes')) {
        const segments = pathname.split('/');
        const id = segments[segments.length - 1];

        if (id) {
          navigateToRecipe(id);
          return true;
        }
      }

      // Add more routes as needed

    } catch (error) {
      console.error('[handleDeepLink] Error handling deep link:', error);
    }

    return false;
  };

  // Process any stored deep links
  const processPendingDeepLink = async () => {
    try {
      const url = await Storage.getItem('pendingDeepLink');
      if (url) {
        const handled = handleDeepLink(url);
        if (handled) {
          await Storage.removeItem('pendingDeepLink');
        }
      }
    } catch (error) {
      console.error('[processPendingDeepLink] Error processing pending link:', error);
    }
  };

  // Check for pending deep links and process them if needed
  const checkAndProcessPendingDeepLinks = async () => {
    const hasPendingLink = await checkForPendingDeepLink();
    if (hasPendingLink) {
      await processPendingDeepLink();
    }
  };

  // Handle auth callback URLs
  const handleAuthCallback = async (url: string) => {
    try {
      const session = await createSessionFromUrl(url);
      if (session) {
        navigateToHome();
        // After auth, check for pending deeplinks
        await checkAndProcessPendingDeepLinks();
      }
    } catch (error) {
      console.error('🔗 Auth Callback Error:', error);
      navigateToInvalidLink();
    }
  };

  // Handle non-auth deep links
  const handleNonAuthDeepLink = (url: string) => {
    if (user) {
      // User is logged in, handle deep link immediately
      handleDeepLink(url);
    } else {
      // User is not logged in, store the deep link for later
      Storage.setItem('pendingDeepLink', url);
    }
  };

  // Process an incoming URL (from initial launch or deep link)
  const processIncomingUrl = async (url: string) => {
    if (!url) return;

    if (url.includes('/auth/callback')) {
      await handleAuthCallback(url);
    } else {
      handleNonAuthDeepLink(url);
    }
  };

  const createSessionFromUrl = async (url: string) => {
    if (!url.includes('/auth/callback')) {
      return null;
    }

    try {
      const { params, errorCode } = QueryParams.getQueryParams(url);

      if (errorCode) {
        console.error('🔗 Error code in URL params:', errorCode);
        throw new Error(errorCode);
      }

      const { access_token, refresh_token, error, error_description } = params;
      if (error) {
        console.error('🔗 Error in URL params:', error, error_description);
        throw new Error(error_description);
      }

      if (!access_token) {
        console.error('🔗 No access token found in URL params');
        throw new Error('No access token found');
      }

      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (sessionError) {
        console.error('🔗 Magic Link Flow - Error setting session:', sessionError);
        throw sessionError;
      }

      return data.session;
    } catch (error) {
      console.error('🔗 Magic Link Flow - Error in createSessionFromUrl:', error);
      throw error;
    }
  };


  const checkForPendingDeepLink = async (): Promise<boolean> => {
    try {
      const pendingUrl = await Storage.getItem('pendingDeepLink');
      if (pendingUrl) {
        return true;
      }
    } catch (error) {
      console.error('Error checking for pending deep link:', error);
    }
    return false;
  };


  const signOut = async () => {
    try {
      setLoading(true);

      // Clear TanStack Query cache for user profile to ensure fresh data on next login
      queryClient.removeQueries({ queryKey: userProfileKeys.all });

      // For web platform, manually clear the Supabase auth token from localStorage
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('supabase') || key.includes('sb-'))) {
            localStorage.removeItem(key);
          }
        }
      }

      // Clear local state
      setSession(null);
      setUser(null);

      // Attempt to sign out of Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error in signOut:', error);
      }
    } catch (error) {
      console.error('Error in signOut:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signOut,
      createSessionFromUrl,
      navigateToHome,
      navigateToInvalidLink,
      handleDeepLink,
      checkForPendingDeepLink,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};