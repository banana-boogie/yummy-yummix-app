import React, { useEffect, useState } from 'react';
import { View, FlatList, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Text } from '@/components/common';
import { CategorySection } from '@/components/shopping-list';
import i18n from '@/i18n';
import { pantryService } from '@/services/pantryService';

export default function PantryScreen() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const { categories } = await pantryService.getPantryItems();
            setData(categories);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', i18n.t('common.error'));
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
                        {item.items.map((pantryItem: any) => (
                            <View key={pantryItem.id} className="flex-row justify-between py-sm border-b border-grey-lightest">
                                <Text>{pantryItem.name}</Text>
                                <Text className="text-text-secondary">{pantryItem.quantity} {pantryItem.unit?.symbol}</Text>
                            </View>
                        ))}
                    </View>
                )}
                contentContainerStyle={{ paddingVertical: 16 }}
                ListEmptyComponent={!loading ? <Text className="text-center mt-xl text-text-secondary">{i18n.t('shoppingList.emptyPantry')}</Text> : null}
            />
        </View>
    );
}
