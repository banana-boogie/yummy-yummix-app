import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
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
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const fetchLists = useCallback(async () => {
        try {
            const data = await shoppingListService.getShoppingLists();
            setLists(data);
        } catch (error) {
            console.error('Error fetching lists:', error);
            toast.showError(i18n.t('common.errors.title'), i18n.t('shoppingList.loadListsError'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchLists();
    }, [fetchLists]);

    const openCreateModal = () => {
        setNewListName('');
        setCreateModalVisible(true);
    };

    const closeCreateModal = () => {
        setCreateModalVisible(false);
        Keyboard.dismiss();
    };

    const handleCreateList = async () => {
        const trimmedName = newListName.trim();
        if (!trimmedName || isCreating) return;

        try {
            setIsCreating(true);
            const newList = await shoppingListService.createShoppingList(trimmedName);
            setLists(prev => [newList, ...prev]);
            toast.showSuccess(i18n.t('shoppingList.listCreated'));
            closeCreateModal();
            router.push(`/shopping/${newList.id}`);
        } catch (error) {
            console.error('Error creating list:', error);
            toast.showError(i18n.t('common.errors.title'), i18n.t('shoppingList.createListError'));
        } finally {
            setIsCreating(false);
        }
    };

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        fetchLists();
    }, [fetchLists]);

    return (
        <View className="flex-1 bg-background-primary" style={{ paddingTop: insets.top }}>
            <View className="flex-row items-center justify-between px-lg py-md">
                <Text preset="h1">{i18n.t('shoppingList.title')}</Text>
                <TouchableOpacity onPress={openCreateModal}>
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
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                ListEmptyComponent={
                    !loading ? (
                        <View className="items-center justify-center mt-xl">
                            <Ionicons name="cart-outline" size={64} color={COLORS.grey.light} />
                            <Text preset="subheading" className="text-text-secondary mt-md text-center">
                                {i18n.t('shoppingList.empty')}
                            </Text>
                            <View className="mt-lg w-full max-w-xs">
                                <Button onPress={openCreateModal}>{i18n.t('shoppingList.createFirst')}</Button>
                            </View>
                        </View>
                    ) : null
                }
            />

            <Modal
                visible={createModalVisible}
                animationType="fade"
                transparent
                onRequestClose={closeCreateModal}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1 bg-black/50 justify-center items-center p-lg"
                >
                    <View className="bg-white rounded-lg p-lg w-full max-w-md">
                        <Text preset="h3" className="text-center mb-sm">
                            {i18n.t('shoppingList.createNew')}
                        </Text>
                        <Text preset="body" className="text-text-secondary text-center mb-md">
                            {i18n.t('shoppingList.enterName')}
                        </Text>
                        <TextInput
                            value={newListName}
                            onChangeText={setNewListName}
                            placeholder={i18n.t('shoppingList.enterName')}
                            placeholderTextColor={COLORS.grey.medium}
                            className="bg-grey-lightest rounded-xl px-md py-sm text-text-default"
                            autoFocus
                            returnKeyType="done"
                            onSubmitEditing={handleCreateList}
                        />
                        <View className="flex-row justify-end mt-md gap-sm">
                            <Button
                                variant="secondary"
                                size="small"
                                onPress={closeCreateModal}
                                label={i18n.t('common.cancel')}
                            />
                            <Button
                                size="small"
                                onPress={handleCreateList}
                                label={i18n.t('common.create')}
                                disabled={!newListName.trim() || isCreating}
                                loading={isCreating}
                            />
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}
