import { Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Redirect } from 'expo-router';

export default function AuthLayout() {
  const { user, loading } = useAuth();

  if (loading) return null;
  // Redirect to "Home" page if user is logged in
  if (user) return <Redirect href="/(tabs)/recipes" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="invalid-link" />
      <Stack.Screen name="callback" />
    </Stack>
  );
} 