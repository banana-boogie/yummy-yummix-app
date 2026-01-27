import { Stack } from 'expo-router';
import { COLORS } from '@/constants/design-tokens';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ShoppingLayout() {
    const { language } = useLanguage();
    // Force rerender when language changes if needed, mainly ensuring headers update

    return (
        <Stack
            key={language}
            screenOptions={{
                headerStyle: { backgroundColor: COLORS.background.primary },
                headerShadowVisible: false,
                headerTintColor: COLORS.text.default,
                headerTitleStyle: { fontFamily: 'Quicksand-Bold', fontSize: 20 },
                headerBackTitleVisible: false,
            }}
        >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="[id]" options={{ title: '' }} />
            <Stack.Screen name="pantry" />
            <Stack.Screen name="favorites" />
        </Stack>
    );
}
