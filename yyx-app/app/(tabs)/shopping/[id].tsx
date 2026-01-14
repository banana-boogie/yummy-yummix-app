import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, FlatList, Alert, LayoutAnimation, Platform, UIManager, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Text } from '@/components/common';
import { CategorySection, AddItemModal } from '@/components/shopping-list';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
import { shoppingListService } from '@/services/shoppingListService';
import { ShoppingListWithItems, ShoppingCategory, ShoppingListItem } from '@/types/shopping-list.types';
import { useToast } from '@/hooks/useToast';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ShoppingListDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const toast = useToast();
    const [list, setList] = useState<ShoppingListWithItems | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [categories, setCategories] = useState<ShoppingCategory[]>([]);

    const fetchList = useCallback(async () => {
        if (!id) return;
        try {
            const data = await shoppingListService.getShoppingListById(id);
            setList(data);
            const cats = await shoppingListService.getCategories();
            setCategories(cats);
        } catch (error) {
            console.error('Error fetching list:', error);
            toast.showError(i18n.t('common.error'), 'Failed to load shopping list');
        } finally {
            setLoading(false);
        }
    }, [id, toast]);

    useEffect(() => {
        fetchList();
    }, [fetchList]);

    const handleCheckItem = async (itemId: string, isChecked: boolean) => {
        // Optimistic update
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setList(current => {
            if (!current) return null;
            const updatedCategories = current.categories.map(cat => ({
                ...cat,
                items: cat.items.map(item => item.id === itemId ? { ...item, isChecked } : item)
            }));
            return { ...current, categories: updatedCategories };
        });

        try {
            await shoppingListService.toggleItemChecked(itemId, isChecked);
        } catch (error) {
            // Revert on error would go here
            console.error('Error toggling item:', error);
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        Alert.alert(
            i18n.t('common.delete'),
            i18n.t('shoppingList.deleteItemConfirm'),
            [
                { text: i18n.t('common.cancel'), style: 'cancel' },
                {
                    text: i18n.t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setList(current => {
                            if (!current) return null;
                            const updatedCategories = current.categories.map(cat => ({
                                ...cat,
                                items: cat.items.filter(item => item.id !== itemId)
                            })).filter(cat => cat.items.length > 0);
                            return { ...current, categories: updatedCategories };
                        });
                        try {
                            await shoppingListService.deleteItem(itemId);
                        } catch (error) { console.error(error); }
                    }
                }
            ]
        );
    };

    const handleAddItem = async (itemData: any) => {
        if (!id || !list) return;
        try {
            await shoppingListService.addItem({ ...itemData, shoppingListId: id });
            toast.showSuccess(i18n.t('shoppingList.itemAdded'));
            fetchList(); // Refresh to ensure correct order/category
        } catch (error) {
            console.error('Error adding item:', error);
            toast.showError(i18n.t('common.error'), 'Failed to add item');
        }
    };

    const handleConsolidate = async () => {
        if (!id) return;
        try {
            const result = await shoppingListService.consolidateItems(id);
            toast.showSuccess(i18n.t('shoppingList.consolidatedCount', { count: result.merged }));
            fetchList();
        } catch (error) {
            console.error('Error consolidating:', error);
            toast.showError(i18n.t('common.error'), 'Failed to consolidate items');
        }
    };

    const handleReorderItems = async (categoryId: string, reorderedItems: ShoppingListItem[]) => {
        // Save previous state for rollback
        const previousList = list;

        // Calculate new display orders (sequential: 1, 2, 3...)
        const updates = reorderedItems.map((item, index) => ({
            id: item.id,
            displayOrder: index + 1,
        }));

        // Optimistic update
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setList(current => {
            if (!current) return null;
            const updatedCategories = current.categories.map(cat => {
                if (cat.id === categoryId) {
                    return {
                        ...cat,
                        items: reorderedItems.map((item, index) => ({
                            ...item,
                            displayOrder: index + 1,
                        })),
                    };
                }
                return cat;
            });
            return { ...current, categories: updatedCategories };
        });

        // Haptic feedback
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            // Persist to database
            await shoppingListService.updateItemsOrder(updates);
        } catch (error) {
            // Rollback on error
            setList(previousList);
            toast.showError(
                i18n.t('common.error'),
                i18n.t('shoppingList.reorderError')
            );
        }
    };

    if (loading) return <View className="flex-1 bg-background-primary justify-center items-center"><Text>Loading...</Text></View>;
    if (!list) return <View className="flex-1 bg-background-primary justify-center items-center"><Text>List not found</Text></View>;

    return (
        <View className="flex-1 bg-background-primary">
            <Stack.Screen options={{
                title: list.name,
                headerRight: () => (
                    <TouchableOpacity onPress={handleConsolidate}>
                        <Ionicons name="git-merge-outline" size={24} color={COLORS.primary.default} />
                    </TouchableOpacity>
                )
            }} />

            <FlatList
                data={list.categories}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <CategorySection
                        category={item}
                        onCheckItem={handleCheckItem}
                        onDeleteItem={handleDeleteItem}
                        onPressItem={(itemId) => { /* TODO: Edit item */ }}
                        onReorderItems={(items) => handleReorderItems(item.id, items)}
                    />
                )}
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            />

            <View className="absolute bottom-lg right-lg">
                <TouchableOpacity
                    onPress={() => setModalVisible(true)}
                    className="w-14 h-14 rounded-full bg-primary-default items-center justify-center shadow-lg"
                >
                    <Ionicons name="add" size={32} color="white" />
                </TouchableOpacity>
            </View>

            <AddItemModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onAddItem={handleAddItem}
                categories={categories}
            />
        </View>
    );
}
