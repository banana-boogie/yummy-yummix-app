import { useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { ShoppingListItem, ShoppingCategoryWithItems } from '@/types/shopping-list.types';

interface UseSelectionModeOptions {
    listId: string | undefined;
    categories: ShoppingCategoryWithItems[] | undefined;
}

interface SelectedItemsInfo {
    items: ShoppingListItem[];
    hasChecked: boolean;
    hasUnchecked: boolean;
}

interface UseSelectionModeReturn {
    // State
    isSelectMode: boolean;
    selectedItems: Set<string>;
    selectedItemsInfo: SelectedItemsInfo;

    // All item IDs (memoized)
    allItemIds: Set<string>;

    // Actions
    toggleSelectMode: () => void;
    toggleItemSelection: (itemId: string) => void;
    handleSelectAll: () => void;
    handleDeselectAll: () => void;
    handleSelectAllInCategory: (itemIds: string[]) => void;
    clearSelection: () => void;
    setSelectedItems: React.Dispatch<React.SetStateAction<Set<string>>>;
}

/**
 * Hook for managing selection mode state and actions.
 */
export function useSelectionMode({ listId, categories }: UseSelectionModeOptions): UseSelectionModeReturn {
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // Memoize all item IDs for performance
    const allItemIds = useMemo(() => {
        const ids = new Set<string>();
        for (const cat of categories ?? []) {
            for (const item of cat.items) {
                ids.add(item.id);
            }
        }
        return ids;
    }, [categories]);

    // Load persisted selection state on mount
    useEffect(() => {
        if (listId && categories && categories.length > 0) {
            AsyncStorage.getItem(`selection_state_${listId}`).then(data => {
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        if (
                            typeof parsed === 'object' &&
                            parsed !== null &&
                            typeof parsed.isSelectMode === 'boolean' &&
                            Array.isArray(parsed.selectedItems) &&
                            parsed.selectedItems.every((item: unknown) => typeof item === 'string')
                        ) {
                            if (parsed.isSelectMode && parsed.selectedItems.length > 0) {
                                // Filter to only include items that still exist
                                const existingItemIds = new Set<string>();
                                for (const cat of categories) {
                                    for (const item of cat.items) {
                                        existingItemIds.add(item.id);
                                    }
                                }
                                const validSelectedItems = parsed.selectedItems.filter(
                                    (id: string) => existingItemIds.has(id)
                                );

                                if (validSelectedItems.length > 0) {
                                    setIsSelectMode(true);
                                    setSelectedItems(new Set(validSelectedItems));
                                } else {
                                    // All selected items were deleted, clear persisted state
                                    AsyncStorage.removeItem(`selection_state_${listId}`).catch(console.error);
                                }
                            }
                        } else {
                            AsyncStorage.removeItem(`selection_state_${listId}`).catch(console.error);
                        }
                    } catch (parseError) {
                        console.warn('Invalid selection state data:', parseError);
                        AsyncStorage.removeItem(`selection_state_${listId}`).catch(console.error);
                    }
                }
            }).catch(console.error);
        }
    }, [listId, categories]);

    // Persist selection state when it changes
    useEffect(() => {
        if (listId) {
            if (isSelectMode && selectedItems.size > 0) {
                AsyncStorage.setItem(`selection_state_${listId}`, JSON.stringify({
                    isSelectMode,
                    selectedItems: Array.from(selectedItems),
                })).catch(console.error);
            } else {
                AsyncStorage.removeItem(`selection_state_${listId}`).catch(console.error);
            }
        }
    }, [listId, isSelectMode, selectedItems]);

    // Calculate selected items info
    const selectedItemsInfo = useMemo(() => {
        const items: ShoppingListItem[] = [];
        for (const cat of categories ?? []) {
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
    }, [categories, selectedItems]);

    // Toggle select mode
    const toggleSelectMode = useCallback(() => {
        setIsSelectMode(prev => !prev);
        setSelectedItems(new Set());
    }, []);

    // Toggle individual item selection
    const toggleItemSelection = useCallback((itemId: string) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) {
                next.delete(itemId);
            } else {
                next.add(itemId);
            }
            return next;
        });
    }, []);

    // Select all items
    const handleSelectAll = useCallback(() => {
        setSelectedItems(new Set(allItemIds));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [allItemIds]);

    // Deselect all items
    const handleDeselectAll = useCallback(() => {
        setSelectedItems(new Set());
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    // Toggle selection of all items in a category
    const handleSelectAllInCategory = useCallback((itemIds: string[]) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            const allSelected = itemIds.every(id => next.has(id));

            if (allSelected) {
                for (const id of itemIds) {
                    next.delete(id);
                }
            } else {
                for (const id of itemIds) {
                    next.add(id);
                }
            }
            return next;
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    // Clear selection and exit select mode
    const clearSelection = useCallback(() => {
        setIsSelectMode(false);
        setSelectedItems(new Set());
    }, []);

    return {
        isSelectMode,
        selectedItems,
        selectedItemsInfo,
        allItemIds,
        toggleSelectMode,
        toggleItemSelection,
        handleSelectAll,
        handleDeselectAll,
        handleSelectAllInCategory,
        clearSelection,
        setSelectedItems,
    };
}

export default useSelectionMode;
