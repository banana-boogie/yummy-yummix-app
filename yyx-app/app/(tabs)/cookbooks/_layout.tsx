import { Stack } from 'expo-router';

export default function CookbooksLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]/index" />
    </Stack>
  );
}
