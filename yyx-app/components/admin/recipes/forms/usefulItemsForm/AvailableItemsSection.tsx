import React from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { AdminUsefulItem } from '@/types/recipe.admin.types';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

interface AvailableItemsSectionProps {
    items: AdminUsefulItem[];
    loading: boolean;
    searchQuery: string;
    selectedItemIds: string[];
    onAddItem: (item: AdminUsefulItem) => void;
    /** Compact variant for mobile (no min-height constraint) */
    variant?: 'default' | 'compact';
}

/**
 * Displays the list of available useful items that can be added to a recipe.
 * Used in both mobile and desktop layouts of RecipeUsefulItemsForm.
 */
export function AvailableItemsSection({
    items,
    loading,
    searchQuery,
    selectedItemIds,
    onAddItem,
    variant = 'default'
}: AvailableItemsSectionProps) {
    const isCompact = variant === 'compact';

    const renderItemCard = (item: AdminUsefulItem) => {
        const isAdded = selectedItemIds.includes(item.id);

        return (
            <TouchableOpacity
                key={item.id}
                className={`flex-row items-center p-sm bg-background-DEFAULT rounded-md mb-xs shadow-md ${isAdded ? 'opacity-70' : ''}`}
                onPress={() => !isAdded && onAddItem(item)}
                disabled={isAdded}
            >
                <View className="w-10 h-10 rounded-sm overflow-hidden bg-background-SECONDARY mr-sm justify-center items-center">
                    {item.pictureUrl ? (
                        <Image
                            source={item.pictureUrl}
                            className="w-full h-full"
                            contentFit="contain"
                            transition={300}
                            cachePolicy="memory-disk"
                        />
                    ) : (
                        <View className="w-full h-full justify-center items-center">
                            <Ionicons name="image-outline" size={20} color={COLORS.text.SECONDARY} />
                        </View>
                    )}
                </View>

                <View className="flex-1">
                    <Text className="font-medium">{item.nameEn}</Text>
                    <Text className="text-xs text-text-SECONDARY">{item.nameEs}</Text>
                </View>

                {isAdded ? (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.primary.DARKEST} />
                ) : (
                    <Ionicons name="add-circle-outline" size={24} color={COLORS.primary.DARKEST} />
                )}
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View className={`p-xl items-center justify-center ${isCompact ? '' : 'min-h-[400px]'}`}>
                <ActivityIndicator size="large" color={COLORS.primary.default} />
                <Text className="mt-sm" color={COLORS.text.secondary}>
                    {i18n.t('common.loading')}
                </Text>
            </View>
        );
    }

    return (
        <View
            className="rounded-lg"
            style={{
                padding: 8,
                backgroundColor: COLORS.background.secondary,
                minHeight: isCompact ? undefined : 400
            }}
        >
            {items.length > 0 ? (
                items.map(item => renderItemCard(item))
            ) : (
                <View className={`p-xl items-center justify-center ${isCompact ? 'min-h-[120px]' : ''}`}>
                    <Ionicons name="information-circle-outline" size={32} color={COLORS.text.secondary} />
                    <Text className="mt-sm text-center" color={COLORS.text.secondary}>
                        {searchQuery
                            ? i18n.t('admin.recipes.form.usefulItemsInfo.noSearchResults')
                            : i18n.t('admin.recipes.form.usefulItemsInfo.noUsefulItems')}
                    </Text>
                </View>
            )}
        </View>
    );
}
