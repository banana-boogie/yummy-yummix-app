import React, { useEffect, ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import '../global.css';
import { useFonts } from '@/hooks/useFonts';
import { NavigationGuard } from '@/components/navigation/NavigationGuard';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { MeasurementProvider } from '@/contexts/MeasurementContext';
import { registerNativeWindInterops } from '@/utils/nativewind';
import { OnboardingProvider } from '@/contexts/OnboardingContext';

import { UserProfileProvider } from '@/contexts/UserProfileContext';
import { queryClient } from '@/lib/queryClient';
import Toast from 'react-native-toast-message';
import { toastConfig } from '@/config/toastConfig';

// Register NativeWind interops for third-party components
registerNativeWindInterops();

// Prevent the splash screen from auto-hiding before asset loading is complete.
// Note: During Fast Refresh in development, this may throw "No native splash screen registered"
// errors which are harmless and can be ignored.
try {
  SplashScreen.preventAutoHideAsync().catch(() => {
    // Ignore - splash screen may already be registered or hidden
  });
} catch {
  // Ignore - splash screen module may be in invalid state during hot reload
}

// Wrapper for providers that need language context
function InnerProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserProfileProvider>
          <OnboardingProvider>
            <MeasurementProvider>
              {children}
            </MeasurementProvider>
          </OnboardingProvider>
        </UserProfileProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default function RootLayout() {
  const loaded = useFonts();

  useEffect(() => {
    if (loaded) {
      // Wrap in try-catch to suppress any errors during Fast Refresh
      try {
        SplashScreen.hideAsync().catch(() => {
          // Ignore - splash screen may already be hidden
        });
      } catch {
        // Ignore - splash screen may be in invalid state during hot reload
      }
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <InnerProviders>
          <Head>
            <title>YummyYummix</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
          </Head>
          <NavigationGuard>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false, title: '' }} />
              <Stack.Screen name="auth" options={{ headerShown: false, title: '' }} />
              <Stack.Screen name="admin" options={{ headerShown: false, title: '' }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '' }} />
            </Stack>
          </NavigationGuard>
        </InnerProviders>
      </LanguageProvider>
      <Toast config={toastConfig} />
    </SafeAreaProvider>
  );
}