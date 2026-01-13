import { Stack } from 'expo-router';

export default function RecipeDetailsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="cooking-guide" />
    </Stack>
  );
} 