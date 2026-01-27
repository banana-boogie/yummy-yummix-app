import { useState, useCallback, useMemo, useEffect } from 'react';
import { LayoutAnimation } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { shoppingListService } from '@/services/shoppingListService';
import {
    ShoppingListWithItems,
    ShoppingCategory,
    ShoppingListItem,
    ShoppingListItemCreate,
    ShoppingCategoryWithItems,
} from '@/types/shopping-list.types';
import { useToast } from './useToast';
import { useUndoableDelete } from './useUndoableDelete';
import { useOfflineSync } from './useOfflineSync';
import i18n from '@/i18n';

interface UseShoppingListDataOptions {
    listId: string | undefined;
}

interface UseShoppingListDataReturn {
    // Data
    list: ShoppingListWithItems | null;
    categories: ShoppingCategory[];
    loading: boolean;
    filteredCategories: ShoppingCategoryWithItems[];

    // Search
    searchQuery: string;
    setSearchQuery: (query: string) => void;

    // Category collapse
    collapsedCategories: Set<string>;
    toggleCategoryCollapse: (categoryId: string) => void;

    // Progress
    progressPercentage: number;

    // Actions
    fetchList: (forceRefresh?: boolean) => Promise<void>;
    handleCheckItem: (itemId: string, isChecked: boolean) => Promise<void>;
    handleDeleteItem: (itemId: string) => void;
    handleAddItem: (itemData: Omit<ShoppingListItemCreate, 'shoppingListId'>) => Promise<void>;
    handleConsolidate: () => Promise<void>;
    handleReorderItems: (categoryId: string, reorderedItems: ShoppingListItem[]) => Promise<void>;

    // For optimistic updates from parent
    setList: React.Dispatch<React.SetStateAction<ShoppingListWithItems | null>>;

    // Offline
    isOffline: boolean;
    isSyncing: boolean;
    pendingCount: number;
    queueMutation: ReturnType<typeof useOfflineSync>['queueMutation'];
}

/**
 * Hook for managing shopping list data, fetching, and item operations.
 */
export function useShoppingListData({ listId }: UseShoppingListDataOptions): UseShoppingListDataReturn {
    const toast = useToast();
    const [list, setList] = useState<ShoppingListWithItems | null>(null);
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<ShoppingCategory[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

    // Offline sync hook
    const { isOffline, isSyncing, pendingCount, queueMutation } = useOfflineSync({
        onSyncComplete: () => fetchList(true),
    });

    // Undoable delete hook
    const { queueDeletion } = useUndoableDelete<ShoppingListItem>(
        (item) => item.id,
        {
            duration: 5000,
            onRestore: (item) => {
                setList(current => {
                    if (!current) return null;
                    const updatedCategories = current.categories.map(cat => {
                        if (cat.id === item.categoryId) {
                            const newItems = [...cat.items, item].sort(
                                (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
                            );
                            return { ...cat, items: newItems };
                        }
                        return cat;
                    });
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

    // Load collapsed categories from storage
    useEffect(() => {
        if (listId) {
            AsyncStorage.getItem(`collapsed_categories_${listId}`).then(data => {
                if (data) {
                    setCollapsedCategories(new Set(JSON.parse(data)));
                }
            }).catch(console.error);
        }
    }, [listId]);

    // Toggle category collapse
    const toggleCategoryCollapse = useCallback((categoryId: string) => {
        setCollapsedCategories(prev => {
            const next = new Set(prev);
            if (next.has(categoryId)) {
                next.delete(categoryId);
            } else {
                next.add(categoryId);
            }
            if (listId) {
                AsyncStorage.setItem(`collapsed_categories_${listId}`, JSON.stringify([...next])).catch(console.error);
            }
            return next;
        });
    }, [listId]);

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

    // Fetch list data
    const fetchList = useCallback(async (forceRefresh = false) => {
        if (!listId) return;
        try {
            const useCache = !forceRefresh;
            const data = await shoppingListService.getShoppingListById(listId, useCache);
            setList(data);
            const cats = await shoppingListService.getCategories(useCache);
            setCategories(cats);
        } catch (error) {
            console.error('Error fetching list:', error);
            toast.showError(i18n.t('common.error'), i18n.t('shoppingList.loadError'));
        } finally {
            setLoading(false);
        }
    }, [listId, toast]);

    useEffect(() => {
        fetchList();
    }, [fetchList]);

    // Check item handler
    const handleCheckItem = useCallback(async (itemId: string, isChecked: boolean) => {
        const previousList = list;

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
                await queueMutation('CHECK_ITEM', { itemId, isChecked });
            } else {
                await shoppingListService.toggleItemChecked(itemId, isChecked);
            }
        } catch (error) {
            setList(previousList);
            toast.showError(i18n.t('common.error'), i18n.t('shoppingList.checkError'));
            console.error('Error toggling item:', error);
        }
    }, [list, isOffline, queueMutation, toast]);

    // Delete item handler
    const handleDeleteItem = useCallback((itemId: string) => {
        let itemToDelete: ShoppingListItem | undefined;
        for (const cat of list?.categories ?? []) {
            const found = cat.items.find(item => item.id === itemId);
            if (found) {
                itemToDelete = found;
                break;
            }
        }
        if (!itemToDelete) return;

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

        queueDeletion(
            itemToDelete,
            async () => {
                if (isOffline) {
                    await queueMutation('DELETE_ITEM', { itemId });
                } else {
                    await shoppingListService.deleteItem(itemId);
                }
            },
            itemToDelete.name
        );
    }, [list, isOffline, queueMutation, queueDeletion]);

    // Add item handler with optimistic update
    const handleAddItem = useCallback(async (itemData: Omit<ShoppingListItemCreate, 'shoppingListId'>) => {
        if (!listId || !list) return;

        // Create a temporary item for optimistic update
        const tempId = `temp-${Date.now()}`;
        const category = categories.find(c => c.id === itemData.categoryId);
        const tempItem: ShoppingListItem = {
            id: tempId,
            shoppingListId: listId,
            ingredientId: itemData.ingredientId,
            categoryId: itemData.categoryId,
            name: itemData.nameCustom || '',
            quantity: itemData.quantity,
            notes: itemData.notes,
            isChecked: false,
            displayOrder: 9999, // Put at end
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const previousList = list;

        // Optimistic update
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setList(current => {
            if (!current) return null;
            const catIndex = current.categories.findIndex(c => c.id === itemData.categoryId);

            if (catIndex >= 0) {
                // Category exists, add item to it
                const updatedCategories = [...current.categories];
                updatedCategories[catIndex] = {
                    ...updatedCategories[catIndex],
                    items: [...updatedCategories[catIndex].items, tempItem],
                };
                return {
                    ...current,
                    categories: updatedCategories,
                    itemCount: current.itemCount + 1,
                };
            } else if (category) {
                // Category doesn't exist in list, create it
                const newCategory: ShoppingCategoryWithItems = {
                    ...category,
                    localizedName: i18n.locale === 'es' ? category.nameEs : category.nameEn,
                    items: [tempItem],
                };
                return {
                    ...current,
                    categories: [...current.categories, newCategory],
                    itemCount: current.itemCount + 1,
                };
            }

            return current;
        });

        try {
            await shoppingListService.addItem({ ...itemData, shoppingListId: listId });
            toast.showSuccess(i18n.t('shoppingList.itemAdded'));
            // Fetch to get the real item with correct ID and all data
            fetchList();
        } catch (error) {
            // Rollback on error
            setList(previousList);
            console.error('Error adding item:', error);
            toast.showError(i18n.t('common.error'), i18n.t('shoppingList.addError'));
        }
    }, [listId, list, categories, toast, fetchList]);

    // Consolidate handler
    const handleConsolidate = useCallback(async () => {
        if (!listId) return;
        try {
            const result = await shoppingListService.consolidateItems(listId);
            toast.showSuccess(i18n.t('shoppingList.consolidatedCount', { count: result.merged }));
            fetchList();
        } catch (error) {
            console.error('Error consolidating:', error);
            toast.showError(i18n.t('common.error'), i18n.t('shoppingList.consolidateError'));
        }
    }, [listId, toast, fetchList]);

    // Reorder items handler
    const handleReorderItems = useCallback(async (categoryId: string, reorderedItems: ShoppingListItem[]) => {
        const previousList = list;

        const updates = reorderedItems.map((item, index) => ({
            id: item.id,
            displayOrder: index + 1,
        }));

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

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            if (isOffline) {
                await queueMutation('REORDER_ITEMS', { updates });
            } else {
                await shoppingListService.updateItemsOrder(updates);
            }
        } catch (error) {
            setList(previousList);
            toast.showError(i18n.t('common.error'), i18n.t('shoppingList.reorderError'));
        }
    }, [list, isOffline, queueMutation, toast]);

    return {
        list,
        categories,
        loading,
        filteredCategories,
        searchQuery,
        setSearchQuery,
        collapsedCategories,
        toggleCategoryCollapse,
        progressPercentage,
        fetchList,
        handleCheckItem,
        handleDeleteItem,
        handleAddItem,
        handleConsolidate,
        handleReorderItems,
        setList,
        isOffline,
        isSyncing,
        pendingCount,
        queueMutation,
    };
}

export default useShoppingListData;
