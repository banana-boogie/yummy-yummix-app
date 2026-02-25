import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
import { getCustomCookingGuidePath } from '@/utils/navigation/recipeRoutes';

/**
 * Redirect screen for starting cooking from chat.
 *
 * This screen exists to work around an Expo Router limitation where
 * router.replace to the same route pattern with different params
 * doesn't update the route. By navigating to this intermediate screen
 * first, we ensure a clean navigation to the cooking guide.
 */
export default function StartCookingRedirect() {
    const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();

    useEffect(() => {
        if (id) {
            // Replace this screen with the cooking guide
            router.replace(getCustomCookingGuidePath(id, from));
        }
    }, [id, from]);

    return (
        <View className="flex-1 bg-background-default justify-center items-center">
            <ActivityIndicator size="large" color={COLORS.primary.default} />
            <Text className="text-text-secondary mt-md">{i18n.t('common.loading')}</Text>
        </View>
    );
}
