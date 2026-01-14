import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/common';
import { ShoppingList } from '@/types/shopping-list.types';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

interface ShoppingListCardProps {
    list: ShoppingList;
    onPress?: (listId: string) => void;
}

export const ShoppingListCard = React.memo(function ShoppingListCard({
    list,
    onPress
}: ShoppingListCardProps) {
    const router = useRouter();

    const handlePress = async () => {
        await Haptics.selectionAsync();
        if (onPress) {
            onPress(list.id);
        } else {
            router.push(`/(tabs)/shopping/${list.id}`);
        }
    };

    const progress = list.itemCount > 0 ? (list.checkedCount / list.itemCount) * 100 : 0;
    const isComplete = list.itemCount > 0 && list.checkedCount === list.itemCount;
    const hasItems = list.itemCount > 0;

    return (
        <Pressable
            onPress={handlePress}
            className="bg-white rounded-lg shadow-md mb-md active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={`${list.name}, ${list.checkedCount} of ${list.itemCount} items checked`}
        >
            <View className="p-lg">
                {/* Header */}
                <View className="flex-row items-center justify-between mb-sm">
                    <View className="flex-1 mr-md">
                        <Text preset="h2" numberOfLines={1} className="mb-xxs">
                            {list.name}
                        </Text>
                        {hasItems && (
                            <Text preset="caption" className="text-text-secondary">
                                {i18n.t('shoppingList.checkedOff', {
                                    checked: list.checkedCount,
                                    total: list.itemCount
                                })}
                            </Text>
                        )}
                        {!hasItems && (
                            <Text preset="caption" className="text-text-secondary">
                                {i18n.t('shoppingList.empty')}
                            </Text>
                        )}
                    </View>
                    <View className={`w-12 h-12 rounded-full items-center justify-center ${isComplete ? 'bg-status-success' : 'bg-primary-light'}`}>
                        <Ionicons
                            name={isComplete ? 'checkmark-circle' : 'cart-outline'}
                            size={28}
                            color={isComplete ? COLORS.neutral.white : COLORS.primary.darkest}
                        />
                    </View>
                </View>

                {/* Progress Bar */}
                {hasItems && (
                    <View className="mt-md">
                        <View className="h-2 bg-grey-light rounded-full overflow-hidden">
                            <View
                                className={`h-full rounded-full ${isComplete ? 'bg-status-success' : 'bg-primary-medium'}`}
                                style={{ width: `${progress}%` }}
                            />
                        </View>
                    </View>
                )}

                {/* Footer - Updated timestamp */}
                <View className="flex-row items-center justify-between mt-md pt-sm border-t border-grey-light">
                    <View className="flex-row items-center">
                        <Ionicons name="time-outline" size={14} color={COLORS.text.secondary} />
                        <Text preset="caption" className="text-text-secondary ml-xs">
                            {new Date(list.updatedAt).toLocaleDateString(i18n.locale, {
                                month: 'short',
                                day: 'numeric',
                                year: new Date(list.updatedAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                            })}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.grey.medium} />
                </View>
            </View>
        </Pressable>
    );
});
