import { Stack } from 'expo-router';
import { COLORS } from '@/constants/design-tokens';
import { useLanguage } from '@/contexts/LanguageContext';
import i18n from '@/i18n';

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
            }}
        >
            <Stack.Screen
                name="index"
                options={{ headerShown: false, title: i18n.t('shoppingList.title') }}
            />
            <Stack.Screen
                name="[id]"
                options={{ title: '', headerBackTitle: '', headerBackButtonDisplayMode: 'minimal' }}
            />
            <Stack.Screen name="pantry" />
            <Stack.Screen name="favorites" />
        </Stack>
    );
}
