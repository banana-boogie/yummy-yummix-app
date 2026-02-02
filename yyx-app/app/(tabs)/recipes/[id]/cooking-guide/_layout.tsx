import { Stack } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useImmersiveMode } from '@/hooks/useImmersiveMode';

export default function CookingGuideLayout() {
  useKeepAwake();
  useImmersiveMode();

  return (
    <Stack
      screenOptions={{
        animation: 'fade',
        headerShown: false,
        autoHideHomeIndicator: true,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="mise-en-place-ingredients" />
      <Stack.Screen name="mise-en-place-useful-items" />
      <Stack.Screen
        name="[step]"
        dangerouslySingular={(name, params) => {
          if (!params?.step) return 'step-unknown';
          return `step-${params.step}`;
        }}
      />
    </Stack>
  );
}