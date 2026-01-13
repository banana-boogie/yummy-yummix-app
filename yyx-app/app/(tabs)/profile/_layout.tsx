import { Stack } from 'expo-router';
import i18n from '@/i18n';
export default function ProfileStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="edit-profile" options={{ title: i18n.t('profile.editProfile') }} />
      <Stack.Screen name="settings" options={{ title: i18n.t('profile.settings') }} />
    </Stack>
  );
} 