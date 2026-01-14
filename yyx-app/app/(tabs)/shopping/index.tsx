import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button } from '@/components/common';
import { ShoppingListCard } from '@/components/shopping-list';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
import { shoppingListService } from '@/services/shoppingListService';
import { ShoppingList } from '@/types/shopping-list.types';
import { useToast } from '@/hooks/useToast';

export default function ShoppingListsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const toast = useToast();
    const [lists, setLists] = useState<ShoppingList[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchLists = useCallback(async () => {
        try {
            const data = await shoppingListService.getShoppingLists();
            setLists(data);
        } catch (error) {
            console.error('Error fetching lists:', error);
            toast.showError(i18n.t('common.error'), 'Failed to load shopping lists');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchLists();
    }, [fetchLists]);

    const handleCreateList = async () => {
        Alert.prompt(
            i18n.t('shoppingList.createNew'),
            i18n.t('shoppingList.enterName'),
            [
                { text: i18n.t('common.cancel'), style: 'cancel' },
                {
                    text: i18n.t('common.create'),
                    onPress: async (name) => {
                        if (!name?.trim()) return;
                        try {
                            const newList = await shoppingListService.createShoppingList(name.trim());
                            setLists([newList, ...lists]);
                            toast.showSuccess(i18n.t('shoppingList.listCreated'));
                            router.push(`/shopping/${newList.id}`);
                        } catch (error) {
                            console.error('Error creating list:', error);
                            toast.showError(i18n.t('common.error'), 'Failed to create shopping list');
                        }
                    },
                },
            ],
            'plain-text'
        );
    };

    return (
        <View className="flex-1 bg-background-primary" style={{ paddingTop: insets.top }}>
            <View className="flex-row items-center justify-between px-lg py-md">
                <Text preset="h1">{i18n.t('shoppingList.title')}</Text>
                <TouchableOpacity onPress={handleCreateList}>
                    <Ionicons name="add-circle" size={32} color={COLORS.primary.default} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={lists}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <ShoppingListCard
                        list={item}
                        onPress={() => router.push(`/shopping/${item.id}`)}
                    />
                )}
                contentContainerStyle={{ padding: 24 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchLists} />}
                ListEmptyComponent={
                    !loading ? (
                        <View className="items-center justify-center mt-xl">
                            <Ionicons name="cart-outline" size={64} color={COLORS.grey.light} />
                            <Text preset="subheading" className="text-text-secondary mt-md text-center">
                                {i18n.t('shoppingList.empty')}
                            </Text>
                            <View className="mt-lg w-full max-w-xs">
                                <Button onPress={handleCreateList}>{i18n.t('shoppingList.createFirst')}</Button>
                            </View>
                        </View>
                    ) : null
                }
            />
        </View>
    );
}
