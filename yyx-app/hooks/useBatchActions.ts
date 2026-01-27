import { useState, useCallback } from 'react';
import { LayoutAnimation } from 'react-native';
import { shoppingListService } from '@/services/shoppingListService';
import { ShoppingListWithItems, ShoppingListItem } from '@/types/shopping-list.types';
import { useToast } from './useToast';
import { useUndoableDelete } from './useUndoableDelete';
import { MutationType, MutationPayloads } from '@/services/offlineQueue/mutationQueue';
import i18n from '@/i18n';

interface UseBatchActionsOptions {
    list: ShoppingListWithItems | null;
    setList: React.Dispatch<React.SetStateAction<ShoppingListWithItems | null>>;
    selectedItems: Set<string>;
    clearSelection: () => void;
    isOffline: boolean;
    queueMutation: <T extends MutationType>(type: T, payload: MutationPayloads[T]) => Promise<string>;
    categories: import('@/types/shopping-list.types').ShoppingCategory[];
}

interface UseBatchActionsReturn {
    // Loading states
    isBatchChecking: boolean;
    isBatchUnchecking: boolean;
    isBatchDeleting: boolean;
    isClearingChecked: boolean;
    isAnyBatchOperationInProgress: boolean;

    // Confirmation modals
    showDeleteConfirm: boolean;
    setShowDeleteConfirm: (show: boolean) => void;
    showClearCheckedConfirm: boolean;
    setShowClearCheckedConfirm: (show: boolean) => void;

    // Actions
    handleBatchCheck: () => Promise<void>;
    handleBatchUncheck: () => Promise<void>;
    handleBatchDeleteRequest: () => void;
    handleBatchDeleteConfirm: () => Promise<void>;
    handleClearCheckedRequest: () => void;
    handleClearCheckedConfirm: () => Promise<void>;
}

/**
 * Hook for managing batch operations on shopping list items.
 */
export function useBatchActions({
    list,
    setList,
    selectedItems,
    clearSelection,
    isOffline,
    queueMutation,
    categories,
}: UseBatchActionsOptions): UseBatchActionsReturn {
    const toast = useToast();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showClearCheckedConfirm, setShowClearCheckedConfirm] = useState(false);
    const [isBatchChecking, setIsBatchChecking] = useState(false);
    const [isBatchUnchecking, setIsBatchUnchecking] = useState(false);
    const [isBatchDeleting, setIsBatchDeleting] = useState(false);
    const [isClearingChecked, setIsClearingChecked] = useState(false);

    // Undoable batch delete hook
    const { queueDeletion: queueBatchDeletion } = useUndoableDelete<ShoppingListItem[]>(
        (items) => items.map(i => i.id).join(','),
        {
            duration: 5000,
            onRestore: (items) => {
                // Restore all items to the list, recreating categories if needed
                setList(current => {
                    if (!current) return null;
                    const updatedCategories = [...current.categories];

                    for (const item of items) {
                        const catIndex = updatedCategories.findIndex(cat => cat.id === item.categoryId);
                        if (catIndex >= 0) {
                            // Category exists, add item back
                            const newItems = [...updatedCategories[catIndex].items, item].sort(
                                (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
                            );
                            updatedCategories[catIndex] = {
                                ...updatedCategories[catIndex],
                                items: newItems,
                            };
                        } else {
                            // Category doesn't exist, recreate it
                            const category = categories.find(c => c.id === item.categoryId);
                            if (category) {
                                updatedCategories.push({
                                    ...category,
                                    localizedName: i18n.locale === 'es' ? category.nameEs : category.nameEn,
                                    items: [item],
                                });
                            }
                        }
                    }

                    const checkedCount = items.filter(i => i.isChecked).length;
                    return {
                        ...current,
                        categories: updatedCategories,
                        itemCount: current.itemCount + items.length,
                        checkedCount: current.checkedCount + checkedCount,
                    };
                });
                toast.showSuccess(i18n.t('shoppingList.itemsRestored', { count: items.length }));
            },
        }
    );

    const isAnyBatchOperationInProgress = isBatchChecking || isBatchUnchecking || isBatchDeleting || isClearingChecked;

    // Batch check handler
    const handleBatchCheck = useCallback(async () => {
        const itemIds = Array.from(selectedItems);
        const previousList = list;

        setIsBatchChecking(true);

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
            clearSelection();
        } catch (error) {
            setList(previousList);
            toast.showError(i18n.t('common.error'), i18n.t('shoppingList.batchError'));
        } finally {
            setIsBatchChecking(false);
        }
    }, [list, selectedItems, isOffline, queueMutation, toast, clearSelection, setList]);

    // Batch uncheck handler
    const handleBatchUncheck = useCallback(async () => {
        const itemIds = Array.from(selectedItems);
        const previousList = list;

        setIsBatchUnchecking(true);

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
            clearSelection();
        } catch (error) {
            setList(previousList);
            toast.showError(i18n.t('common.error'), i18n.t('shoppingList.batchError'));
        } finally {
            setIsBatchUnchecking(false);
        }
    }, [list, selectedItems, isOffline, queueMutation, toast, clearSelection, setList]);

    // Show delete confirmation modal
    const handleBatchDeleteRequest = useCallback(() => {
        setShowDeleteConfirm(true);
    }, []);

    // Confirm batch delete
    const handleBatchDeleteConfirm = useCallback(async () => {
        setShowDeleteConfirm(false);
        setIsBatchDeleting(true);

        const itemIds = Array.from(selectedItems);
        const previousList = list;

        // Collect items being deleted for undo
        const itemsToDelete: ShoppingListItem[] = [];
        let checkedItemsDeleted = 0;
        for (const cat of list?.categories ?? []) {
            for (const item of cat.items) {
                if (selectedItems.has(item.id)) {
                    itemsToDelete.push(item);
                    if (item.isChecked) {
                        checkedItemsDeleted++;
                    }
                }
            }
        }

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

        clearSelection();
        // Reset loading state immediately - undo will handle UI restoration
        setIsBatchDeleting(false);

        // Queue batch deletion with undo capability
        queueBatchDeletion(
            itemsToDelete,
            async () => {
                if (isOffline) {
                    await queueMutation('BATCH_DELETE', { itemIds });
                } else {
                    await shoppingListService.batchDeleteItems(itemIds);
                }
            },
            i18n.t('shoppingList.itemsCount', { count: itemIds.length })
        );
    }, [list, selectedItems, isOffline, queueMutation, clearSelection, setList, queueBatchDeletion]);

    // Show clear checked confirmation modal
    const handleClearCheckedRequest = useCallback(() => {
        setShowClearCheckedConfirm(true);
    }, []);

    // Clear all checked items (after confirmation)
    const handleClearCheckedConfirm = useCallback(async () => {
        setShowClearCheckedConfirm(false);
        if (!list) return;

        setIsClearingChecked(true);
        const previousList = list;

        // Collect all checked items
        const checkedItems: ShoppingListItem[] = [];
        const checkedItemIds: string[] = [];
        for (const cat of list.categories) {
            for (const item of cat.items) {
                if (item.isChecked) {
                    checkedItems.push(item);
                    checkedItemIds.push(item.id);
                }
            }
        }

        if (checkedItemIds.length === 0) {
            setIsClearingChecked(false);
            return;
        }

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setList(current => {
            if (!current) return null;
            const updatedCategories = current.categories.map(cat => ({
                ...cat,
                items: cat.items.filter(item => !item.isChecked),
            })).filter(cat => cat.items.length > 0);
            return {
                ...current,
                categories: updatedCategories,
                itemCount: current.itemCount - checkedItemIds.length,
                checkedCount: 0,
            };
        });

        // Reset loading state immediately
        setIsClearingChecked(false);

        // Queue deletion with undo capability
        queueBatchDeletion(
            checkedItems,
            async () => {
                if (isOffline) {
                    await queueMutation('BATCH_DELETE', { itemIds: checkedItemIds });
                } else {
                    await shoppingListService.batchDeleteItems(checkedItemIds);
                }
            },
            i18n.t('shoppingList.checkedItemsCount', { count: checkedItemIds.length })
        );
    }, [list, isOffline, queueMutation, setList, queueBatchDeletion]);

    return {
        isBatchChecking,
        isBatchUnchecking,
        isBatchDeleting,
        isClearingChecked,
        isAnyBatchOperationInProgress,
        showDeleteConfirm,
        setShowDeleteConfirm,
        showClearCheckedConfirm,
        setShowClearCheckedConfirm,
        handleBatchCheck,
        handleBatchUncheck,
        handleBatchDeleteRequest,
        handleBatchDeleteConfirm,
        handleClearCheckedRequest,
        handleClearCheckedConfirm,
    };
}

export default useBatchActions;
