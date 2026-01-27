import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, FlatList, LayoutAnimation, Platform, UIManager, TouchableOpacity, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Text, OfflineBanner, AlertModal } from '@/components/common';
import { CategorySection, AddItemModal, FloatingActionBar } from '@/components/shopping-list';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
import { shoppingListService } from '@/services/shoppingListService';
import { ShoppingListWithItems, ShoppingCategory, ShoppingListItem } from '@/types/shopping-list.types';
import { useToast } from '@/hooks/useToast';
import { useUndoableDelete } from '@/hooks/useUndoableDelete';
import { useOfflineSync } from '@/hooks/useOfflineSync';

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
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Offline sync hook
    const { isOffline, isSyncing, pendingCount, queueMutation } = useOfflineSync({
        onSyncComplete: () => fetchList(true), // Force refresh after sync to get latest server data
    });

    // Undoable delete hook
    const { queueDeletion, undoDeletion } = useUndoableDelete<ShoppingListItem>(
        (item) => item.id,
        {
            duration: 5000,
            onRestore: (item) => {
                // Restore item to the list
                setList(current => {
                    if (!current) return null;
                    const updatedCategories = current.categories.map(cat => {
                        if (cat.id === item.categoryId) {
                            // Insert item back, sorted by display order
                            const newItems = [...cat.items, item].sort(
                                (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
                            );
                            return { ...cat, items: newItems };
                        }
                        return cat;
                    });
                    // If category doesn't exist, we need to add it back
                    const categoryExists = updatedCategories.some(cat => cat.id === item.categoryId);
                    if (!categoryExists) {
                        const category = categories.find(c => c.id === item.categoryId);
                        if (category) {
                            updatedCategories.push({
                                ...category,
                                localizedName: i18n.locale === 'es' ? category.nameEs : category.nameEn,
                                items: [item],
                            });
                        }
                    }
                    return {
                        ...current,
                        categories: updatedCategories,
                        itemCount: current.itemCount + 1,
                        checkedCount: item.isChecked ? current.checkedCount + 1 : current.checkedCount,
                    };
                });
                toast.showSuccess(i18n.t('shoppingList.itemRestored'));
            },
        }
    );

    // Load collapsed categories and selection state from storage on mount
    useEffect(() => {
        if (id) {
            // Load collapsed categories
            AsyncStorage.getItem(`collapsed_categories_${id}`).then(data => {
                if (data) {
                    setCollapsedCategories(new Set(JSON.parse(data)));
                }
            }).catch(console.error);

            // Load persisted selection state
            AsyncStorage.getItem(`selection_state_${id}`).then(data => {
                if (data) {
                    const { isSelectMode: savedSelectMode, selectedItems: savedItems } = JSON.parse(data);
                    if (savedSelectMode && savedItems?.length > 0) {
                        setIsSelectMode(true);
                        setSelectedItems(new Set(savedItems));
                    }
                }
            }).catch(console.error);
        }
    }, [id]);

    // Persist selection state when it changes
    useEffect(() => {
        if (id) {
            if (isSelectMode && selectedItems.size > 0) {
                // Save selection state
                AsyncStorage.setItem(`selection_state_${id}`, JSON.stringify({
                    isSelectMode,
                    selectedItems: Array.from(selectedItems),
                })).catch(console.error);
            } else {
                // Clear persisted state when exiting select mode
                AsyncStorage.removeItem(`selection_state_${id}`).catch(console.error);
            }
        }
    }, [id, isSelectMode, selectedItems]);

    // Toggle category collapse and persist to storage
    const toggleCategoryCollapse = useCallback((categoryId: string) => {
        setCollapsedCategories(prev => {
            const next = new Set(prev);
            if (next.has(categoryId)) {
                next.delete(categoryId);
            } else {
                next.add(categoryId);
            }
            // Persist to AsyncStorage
            if (id) {
                AsyncStorage.setItem(`collapsed_categories_${id}`, JSON.stringify([...next])).catch(console.error);
            }
            return next;
        });
    }, [id]);

    // Filter categories based on search query
    const filteredCategories = useMemo(() => {
        if (!searchQuery.trim()) return list?.categories ?? [];

        const query = searchQuery.toLowerCase();
        return (list?.categories ?? [])
            .map(cat => ({
                ...cat,
                items: cat.items.filter(item =>
                    item.name.toLowerCase().includes(query) ||
                    item.notes?.toLowerCase().includes(query)
                )
            }))
            .filter(cat => cat.items.length > 0);
    }, [list?.categories, searchQuery]);

    // Calculate progress
    const progressPercentage = list ?
        Math.round((list.checkedCount / Math.max(list.itemCount, 1)) * 100) : 0;

    const fetchList = useCallback(async (forceRefresh = false) => {
        if (!id) return;
        try {
            // When forceRefresh is true, bypass cache to get fresh data
            // Otherwise use cache (useful for offline scenarios)
            const useCache = !forceRefresh;
            const data = await shoppingListService.getShoppingListById(id, useCache);
            setList(data);
            const cats = await shoppingListService.getCategories(useCache);
            setCategories(cats);
        } catch (error) {
            console.error('Error fetching list:', error);
            toast.showError(i18n.t('common.error'), i18n.t('shoppingList.loadError'));
        } finally {
            setLoading(false);
        }
    }, [id, toast]);

    useEffect(() => {
        fetchList();
    }, [fetchList]);

    const handleCheckItem = async (itemId: string, isChecked: boolean) => {
        // Save previous state for rollback
        const previousList = list;

        // Optimistic update
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setList(current => {
            if (!current) return null;
            const updatedCategories = current.categories.map(cat => ({
                ...cat,
                items: cat.items.map(item => item.id === itemId ? { ...item, isChecked } : item)
            }));
            const newCheckedCount = updatedCategories.reduce(
                (count, cat) => count + cat.items.filter(item => item.isChecked).length,
                0
            );
            return { ...current, categories: updatedCategories, checkedCount: newCheckedCount };
        });

        try {
            if (isOffline) {
                // Queue for later sync
                await queueMutation('CHECK_ITEM', { itemId, isChecked });
            } else {
                await shoppingListService.toggleItemChecked(itemId, isChecked);
            }
        } catch (error) {
            // Rollback on error
            setList(previousList);
            toast.showError(i18n.t('common.error'), i18n.t('shoppingList.checkError'));
            console.error('Error toggling item:', error);
        }
    };

    const handleDeleteItem = (itemId: string) => {
        // Find the item to delete
        let itemToDelete: ShoppingListItem | undefined;
        for (const cat of list?.categories ?? []) {
            const found = cat.items.find(item => item.id === itemId);
            if (found) {
                itemToDelete = found;
                break;
            }
        }
        if (!itemToDelete) return;

        // Optimistically remove from UI
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setList(current => {
            if (!current) return null;
            const updatedCategories = current.categories.map(cat => ({
                ...cat,
                items: cat.items.filter(item => item.id !== itemId)
            })).filter(cat => cat.items.length > 0);
            return {
                ...current,
                categories: updatedCategories,
                itemCount: current.itemCount - 1,
                checkedCount: itemToDelete?.isChecked ? current.checkedCount - 1 : current.checkedCount,
            };
        });

        // Queue deletion with undo capability
        queueDeletion(
            itemToDelete,
            async () => {
                if (isOffline) {
                    // Queue for later sync
                    await queueMutation('DELETE_ITEM', { itemId });
                } else {
                    await shoppingListService.deleteItem(itemId);
                }
            },
            itemToDelete.name
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
            toast.showError(i18n.t('common.error'), i18n.t('shoppingList.addError'));
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
            toast.showError(i18n.t('common.error'), i18n.t('shoppingList.consolidateError'));
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
            // Persist to database or queue for later
            if (isOffline) {
                await queueMutation('REORDER_ITEMS', { updates });
            } else {
                await shoppingListService.updateItemsOrder(updates);
            }
        } catch (error) {
            // Rollback on error
            setList(previousList);
            toast.showError(
                i18n.t('common.error'),
                i18n.t('shoppingList.reorderError')
            );
        }
    };

    // Selection mode handlers
    const toggleSelectMode = () => {
        setIsSelectMode(!isSelectMode);
        setSelectedItems(new Set());
    };

    const toggleItemSelection = (itemId: string) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) {
                next.delete(itemId);
            } else {
                next.add(itemId);
            }
            return next;
        });
    };

    // Select all items in the entire list
    const handleSelectAll = useCallback(() => {
        const allItemIds = new Set<string>();
        for (const cat of list?.categories ?? []) {
            for (const item of cat.items) {
                allItemIds.add(item.id);
            }
        }
        setSelectedItems(allItemIds);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [list?.categories]);

    // Toggle selection of all items in a specific category
    const handleSelectAllInCategory = useCallback((categoryId: string, itemIds: string[]) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            // Check if all items in this category are already selected
            const allSelected = itemIds.every(id => next.has(id));

            if (allSelected) {
                // Deselect all items in this category
                for (const id of itemIds) {
                    next.delete(id);
                }
            } else {
                // Select all items in this category
                for (const id of itemIds) {
                    next.add(id);
                }
            }
            return next;
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    const selectedItemsInfo = useMemo(() => {
        const items: ShoppingListItem[] = [];
        for (const cat of list?.categories ?? []) {
            for (const item of cat.items) {
                if (selectedItems.has(item.id)) {
                    items.push(item);
                }
            }
        }
        return {
            items,
            hasChecked: items.some(i => i.isChecked),
            hasUnchecked: items.some(i => !i.isChecked),
        };
    }, [list?.categories, selectedItems]);

    const handleBatchCheck = async () => {
        const itemIds = Array.from(selectedItems);
        const previousList = list;

        // Optimistic update
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setList(current => {
            if (!current) return null;
            const updatedCategories = current.categories.map(cat => ({
                ...cat,
                items: cat.items.map(item =>
                    selectedItems.has(item.id) ? { ...item, isChecked: true } : item
                ),
            }));
            const newCheckedCount = updatedCategories.reduce(
                (count, cat) => count + cat.items.filter(item => item.isChecked).length,
                0
            );
            return { ...current, categories: updatedCategories, checkedCount: newCheckedCount };
        });

        try {
            if (isOffline) {
                await queueMutation('BATCH_CHECK', { itemIds, isChecked: true });
            } else {
                await shoppingListService.batchUpdateItems(itemIds, { isChecked: true });
            }
            toast.showSuccess(i18n.t('shoppingList.batchCheckSuccess', { count: itemIds.length }));
            setIsSelectMode(false);
            setSelectedItems(new Set());
        } catch (error) {
            setList(previousList);
            toast.showError(i18n.t('common.error'), i18n.t('shoppingList.batchError'));
        }
    };

    const handleBatchUncheck = async () => {
        const itemIds = Array.from(selectedItems);
        const previousList = list;

        // Optimistic update
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setList(current => {
            if (!current) return null;
            const updatedCategories = current.categories.map(cat => ({
                ...cat,
                items: cat.items.map(item =>
                    selectedItems.has(item.id) ? { ...item, isChecked: false } : item
                ),
            }));
            const newCheckedCount = updatedCategories.reduce(
                (count, cat) => count + cat.items.filter(item => item.isChecked).length,
                0
            );
            return { ...current, categories: updatedCategories, checkedCount: newCheckedCount };
        });

        try {
            if (isOffline) {
                await queueMutation('BATCH_CHECK', { itemIds, isChecked: false });
            } else {
                await shoppingListService.batchUpdateItems(itemIds, { isChecked: false });
            }
            toast.showSuccess(i18n.t('shoppingList.batchUncheckSuccess', { count: itemIds.length }));
            setIsSelectMode(false);
            setSelectedItems(new Set());
        } catch (error) {
            setList(previousList);
            toast.showError(i18n.t('common.error'), i18n.t('shoppingList.batchError'));
        }
    };

    const handleBatchDeleteRequest = () => {
        // Show confirmation modal
        setShowDeleteConfirm(true);
    };

    const handleBatchDeleteConfirm = async () => {
        setShowDeleteConfirm(false);

        const itemIds = Array.from(selectedItems);
        const previousList = list;

        // Count how many checked items are being deleted for accurate checkedCount update
        let checkedItemsDeleted = 0;
        for (const cat of list?.categories ?? []) {
            for (const item of cat.items) {
                if (selectedItems.has(item.id) && item.isChecked) {
                    checkedItemsDeleted++;
                }
            }
        }

        // Optimistic update
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setList(current => {
            if (!current) return null;
            const updatedCategories = current.categories.map(cat => ({
                ...cat,
                items: cat.items.filter(item => !selectedItems.has(item.id)),
            })).filter(cat => cat.items.length > 0);
            return {
                ...current,
                categories: updatedCategories,
                itemCount: current.itemCount - itemIds.length,
                checkedCount: current.checkedCount - checkedItemsDeleted,
            };
        });

        try {
            if (isOffline) {
                await queueMutation('BATCH_DELETE', { itemIds });
            } else {
                await shoppingListService.batchDeleteItems(itemIds);
            }
            toast.showSuccess(i18n.t('shoppingList.batchDeleteSuccess', { count: itemIds.length }));
            setIsSelectMode(false);
            setSelectedItems(new Set());
        } catch (error) {
            setList(previousList);
            toast.showError(i18n.t('common.error'), i18n.t('shoppingList.batchError'));
        }
    };

    if (loading) return <View className="flex-1 bg-background-primary justify-center items-center"><Text>{i18n.t('common.loading')}</Text></View>;
    if (!list) return <View className="flex-1 bg-background-primary justify-center items-center"><Text>{i18n.t('shoppingList.listNotFound')}</Text></View>;

    return (
        <View className="flex-1 bg-background-primary">
            {/* Offline banner */}
            <OfflineBanner
                isOffline={isOffline}
                isSyncing={isSyncing}
                pendingCount={pendingCount}
            />

            <Stack.Screen options={{
                title: list.name,
                headerRight: () => (
                    <View className="flex-row items-center">
                        {!isSelectMode && (
                            <TouchableOpacity onPress={handleConsolidate} className="mr-md">
                                <Ionicons name="git-merge-outline" size={24} color={COLORS.primary.default} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={toggleSelectMode}>
                            <Ionicons
                                name={isSelectMode ? 'close' : 'checkbox-outline'}
                                size={24}
                                color={isSelectMode ? COLORS.grey.dark : COLORS.primary.default}
                            />
                        </TouchableOpacity>
                    </View>
                )
            }} />

            {/* Progress Indicator */}
            <View className="px-md pt-md pb-sm">
                <View className="flex-row items-center justify-between mb-xs">
                    <Text preset="caption" className="text-text-secondary">
                        {i18n.t('shoppingList.progress', {
                            checked: list.checkedCount,
                            total: list.itemCount
                        })}
                    </Text>
                    <Text preset="caption" className="text-text-secondary font-semibold">
                        {progressPercentage}%
                    </Text>
                </View>
                <View className="h-2 bg-grey-light rounded-full overflow-hidden">
                    <View
                        className="h-full bg-status-success rounded-full"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </View>
            </View>

            {/* Search Bar */}
            <View className="px-md pb-sm">
                <View className="flex-row items-center bg-grey-lightest rounded-lg px-sm py-xs">
                    <Ionicons name="search" size={18} color={COLORS.grey.medium} />
                    <TextInput
                        className="flex-1 ml-sm py-xs text-text-default"
                        placeholder={i18n.t('shoppingList.searchItems')}
                        placeholderTextColor={COLORS.grey.medium}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color={COLORS.grey.medium} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <FlatList
                data={filteredCategories}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <CategorySection
                        category={item}
                        onCheckItem={handleCheckItem}
                        onDeleteItem={handleDeleteItem}
                        onPressItem={(itemId) => { /* TODO: Edit item */ }}
                        onReorderItems={(items) => handleReorderItems(item.id, items)}
                        isExpanded={!collapsedCategories.has(item.id)}
                        onToggleExpand={() => toggleCategoryCollapse(item.id)}
                        isSelectMode={isSelectMode}
                        selectedItems={selectedItems}
                        onToggleSelection={toggleItemSelection}
                        onSelectAllInCategory={handleSelectAllInCategory}
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

            {/* Floating action bar for batch operations */}
            {isSelectMode && (
                <FloatingActionBar
                    selectedCount={selectedItems.size}
                    totalCount={list.itemCount}
                    onCheckAll={handleBatchCheck}
                    onUncheckAll={handleBatchUncheck}
                    onDeleteAll={handleBatchDeleteRequest}
                    onCancel={toggleSelectMode}
                    onSelectAll={handleSelectAll}
                    hasCheckedItems={selectedItemsInfo.hasChecked}
                    hasUncheckedItems={selectedItemsInfo.hasUnchecked}
                />
            )}

            {/* Batch delete confirmation modal */}
            <AlertModal
                visible={showDeleteConfirm}
                title={i18n.t('common.delete')}
                message={i18n.t('shoppingList.batchDeleteConfirm', { count: selectedItems.size })}
                confirmText={i18n.t('common.delete')}
                cancelText={i18n.t('common.cancel')}
                isDestructive={true}
                onConfirm={handleBatchDeleteConfirm}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </View>
    );
}
