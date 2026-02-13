import { useRef, useCallback, useEffect } from 'react';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import i18n from '@/i18n';

interface PendingDeletion<T> {
    item: T;
    timeoutId: ReturnType<typeof setTimeout>;
    onConfirm: () => Promise<void>;
}

interface UseUndoableDeleteOptions<T> {
    /** Duration in ms before deletion is committed (default: 5000) */
    duration?: number;
    /** Callback when item is restored */
    onRestore?: (item: T) => void;
    /** Callback when deletion is committed */
    onCommit?: (item: T) => void;
    /** Callback when an error occurs during commit */
    onError?: (item: T, error: Error) => void;
}

interface UseUndoableDeleteReturn<T> {
    /** Queue an item for deletion with undo capability */
    queueDeletion: (
        item: T,
        onConfirm: () => Promise<void>,
        displayName?: string
    ) => void;
    /** Undo a pending deletion by item ID */
    undoDeletion: (itemId: string) => T | undefined;
    /** Check if an item has a pending deletion */
    hasPendingDeletion: (itemId: string) => boolean;
    /** Cancel all pending deletions (for cleanup) */
    cancelAllPending: () => void;
}

/**
 * Hook for managing undoable deletions with toast notifications.
 * Items are queued for deletion and committed after a timeout unless undone.
 *
 * @param getItemId - Function to extract ID from item
 * @param options - Configuration options
 *
 * @example
 * const { queueDeletion } = useUndoableDelete<ShoppingListItem>(
 *   (item) => item.id,
 *   { duration: 5000 }
 * );
 *
 * const handleDelete = (item) => {
 *   setItems(prev => prev.filter(i => i.id !== item.id));
 *   queueDeletion(item, () => shoppingListService.deleteItem(item.id, item.shoppingListId), item.name);
 * };
 */
export function useUndoableDelete<T>(
    getItemId: (item: T) => string,
    options: UseUndoableDeleteOptions<T> = {}
): UseUndoableDeleteReturn<T> {
    const { duration = 5000, onRestore, onCommit, onError } = options;
    const pendingDeletions = useRef<Map<string, PendingDeletion<T>>>(new Map());

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Commit all pending deletions on unmount
            pendingDeletions.current.forEach((pending) => {
                clearTimeout(pending.timeoutId);
                pending.onConfirm().catch(console.error);
            });
            pendingDeletions.current.clear();
        };
    }, []);

    // Define undoDeletion first so it can be referenced by queueDeletion
    const undoDeletion = useCallback(
        (itemId: string): T | undefined => {
            const pending = pendingDeletions.current.get(itemId);
            if (!pending) return undefined;

            clearTimeout(pending.timeoutId);
            pendingDeletions.current.delete(itemId);

            // Hide the toast
            Toast.hide();

            onRestore?.(pending.item);
            return pending.item;
        },
        [onRestore]
    );

    const queueDeletion = useCallback(
        (item: T, onConfirm: () => Promise<void>, displayName?: string) => {
            const itemId = getItemId(item);

            // Cancel any existing pending deletion for this item
            const existing = pendingDeletions.current.get(itemId);
            if (existing) {
                clearTimeout(existing.timeoutId);
            }

            // Create timeout to commit deletion
            const timeoutId = setTimeout(async () => {
                pendingDeletions.current.delete(itemId);
                try {
                    await onConfirm();
                    onCommit?.(item);
                } catch (error) {
                    console.error('Error committing deletion:', error);
                    onError?.(item, error as Error);
                }
            }, duration);

            // Store pending deletion
            pendingDeletions.current.set(itemId, {
                item,
                timeoutId,
                onConfirm,
            });

            // Show undo toast
            Toast.show({
                type: 'undo',
                text1: i18n.t('shoppingList.itemDeleted'),
                text2: displayName,
                position: 'bottom',
                visibilityTime: duration,
                bottomOffset: 100,
                props: {
                    itemId,
                    duration,
                    onUndo: () => {
                        const restored = undoDeletion(itemId);
                        if (restored) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }
                    },
                },
            });

            // Haptic feedback for deletion
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
        [duration, getItemId, onCommit, onError, undoDeletion]
    );

    const hasPendingDeletion = useCallback((itemId: string): boolean => {
        return pendingDeletions.current.has(itemId);
    }, []);

    const cancelAllPending = useCallback(() => {
        pendingDeletions.current.forEach((pending) => {
            clearTimeout(pending.timeoutId);
        });
        pendingDeletions.current.clear();
        Toast.hide();
    }, []);

    return {
        queueDeletion,
        undoDeletion,
        hasPendingDeletion,
        cancelAllPending,
    };
}

export default useUndoableDelete;
