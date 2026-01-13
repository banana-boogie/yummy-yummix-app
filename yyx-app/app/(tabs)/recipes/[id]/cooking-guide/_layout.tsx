import { Stack } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';

export default function CookingGuideLayout() {
  useKeepAwake();
  return (
    <Stack
      screenOptions={{
        animation: 'fade',
        headerShown: false,
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