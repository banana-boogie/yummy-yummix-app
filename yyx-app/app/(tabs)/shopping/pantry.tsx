import React, { useEffect, useState } from 'react';
import { View, FlatList } from 'react-native';
import { Stack } from 'expo-router';
import { Text } from '@/components/common';
import { SPACING } from '@/constants/design-tokens';
import i18n from '@/i18n';
import { pantryService } from '@/services/pantryService';
import { PantryItem, ShoppingCategory } from '@/types/shopping-list.types';
import { useToast } from '@/hooks/useToast';

export default function PantryScreen() {
    const [data, setData] = useState<(ShoppingCategory & { localizedName: string; items: PantryItem[] })[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const fetchData = async () => {
        try {
            const { categories } = await pantryService.getPantryItems();
            setData(categories);
        } catch (error) {
            console.error(error);
            toast.showError(i18n.t('common.errors.title'), i18n.t('common.errors.default'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Reuse CategorySection but adapt props for pantry (simplified for now)
    // Pantry items might not need "check" logic in the same way, but checking could deplete them?
    // For now, we mainly display them.

    return (
        <View className="flex-1 bg-background-primary">
            <Stack.Screen options={{ title: i18n.t('shoppingList.pantry') }} />
            <FlatList
                data={data}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View className="mb-md px-md">
                        <Text preset="subheading" className="mb-xs">{item.localizedName}</Text>
                        {item.items.map((pantryItem: PantryItem) => (
                            <View key={pantryItem.id} className="flex-row justify-between py-sm border-b border-grey-lightest">
                                <Text>{pantryItem.name}</Text>
                                <Text className="text-text-secondary">{pantryItem.quantity} {pantryItem.unit?.symbol}</Text>
                            </View>
                        ))}
                    </View>
                )}
                contentContainerStyle={{ paddingVertical: SPACING.md }}
                ListEmptyComponent={!loading ? <Text className="text-center mt-xl text-text-secondary">{i18n.t('shoppingList.emptyPantry')}</Text> : null}
            />
        </View>
    );
}
