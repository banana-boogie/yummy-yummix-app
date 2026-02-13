import React, { useEffect, useState } from 'react';
import { View, FlatList } from 'react-native';
import { Stack } from 'expo-router';
import { Text } from '@/components/common';
import i18n from '@/i18n';
import { pantryService } from '@/services/pantryService';
import { FavoriteShoppingItem } from '@/types/shopping-list.types';

export default function FavoritesScreen() {
    const [favorites, setFavorites] = useState<FavoriteShoppingItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchFavorites = async () => {
        try {
            const data = await pantryService.getFavorites();
            setFavorites(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFavorites();
    }, []);

    return (
        <View className="flex-1 bg-background-primary">
            <Stack.Screen options={{ title: i18n.t('shoppingList.favorites') }} />
            <FlatList
                data={favorites}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View className="flex-row items-center justify-between p-md border-b border-grey-lightest bg-neutral-white">
                        <View className="flex-1">
                            <Text preset="body" className="font-medium">{item.name}</Text>
                            <Text preset="caption" className="text-text-secondary">
                                {i18n.t('shoppingList.purchasedTimes', { count: item.purchaseCount })}
                            </Text>
                        </View>
                    </View>
                )}
                contentContainerStyle={{ padding: 0 }}
                ListEmptyComponent={!loading ? <Text className="text-center mt-xl text-text-secondary">{i18n.t('shoppingList.emptyFavorites')}</Text> : null}
            />
        </View>
    );
}
