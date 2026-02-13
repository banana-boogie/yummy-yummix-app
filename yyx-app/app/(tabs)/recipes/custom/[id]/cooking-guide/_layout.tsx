import { Stack, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';

export default function CustomCookingGuideLayout() {
  useKeepAwake();

  // Get the recipe ID and session to use as a key
  // This forces complete stack reset when either changes, ensuring we always start fresh
  const { id, session } = useLocalSearchParams<{ id: string; session?: string }>();

  return (
    <Stack
      key={`cooking-guide-${id}-${session || 'default'}`}
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
