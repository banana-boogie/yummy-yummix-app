import { useState, useEffect, useCallback, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { mutationQueue, MutationType, MutationPayloads, PendingMutation } from '@/services/offlineQueue/mutationQueue';
import { shoppingListService } from '@/services/shoppingListService';
import { useToast } from './useToast';
import i18n from '@/i18n';

interface UseOfflineSyncOptions {
    /** Callback when sync completes */
    onSyncComplete?: () => void;
    /** Whether to auto-sync when coming back online */
    autoSync?: boolean;
}

interface UseOfflineSyncReturn {
    /** Whether device is offline */
    isOffline: boolean;
    /** Whether sync is in progress */
    isSyncing: boolean;
    /** Number of pending mutations */
    pendingCount: number;
    /** Manually trigger sync */
    syncNow: () => Promise<void>;
    /** Queue a mutation for offline processing */
    queueMutation: <T extends MutationType>(type: T, payload: MutationPayloads[T]) => Promise<string>;
    /** Refresh pending count */
    refreshPendingCount: () => Promise<void>;
}

/**
 * Hook for managing offline synchronization.
 * Automatically syncs pending mutations when device comes back online.
 *
 * @example
 * const { isOffline, isSyncing, pendingCount, queueMutation } = useOfflineSync({
 *   onSyncComplete: () => fetchList(),
 * });
 *
 * const handleDelete = async (itemId: string) => {
 *   if (isOffline) {
 *     await queueMutation('DELETE_ITEM', { itemId });
 *   } else {
 *     await shoppingListService.deleteItem(itemId);
 *   }
 * };
 */
export function useOfflineSync(options: UseOfflineSyncOptions = {}): UseOfflineSyncReturn {
    const { onSyncComplete, autoSync = true } = options;
    const { isConnected } = useNetworkStatus();
    const toast = useToast();

    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const wasOfflineRef = useRef(false);

    const isOffline = !isConnected;

    // Refresh pending count
    const refreshPendingCount = useCallback(async () => {
        const count = await mutationQueue.getCount();
        setPendingCount(count);
    }, []);

    // Validate payload structure for a mutation
    const validatePayload = (mutation: PendingMutation): boolean => {
        const { type, payload } = mutation;

        switch (type) {
            case 'DELETE_ITEM':
                return typeof payload?.itemId === 'string' && payload.itemId.length > 0;

            case 'CHECK_ITEM':
                return typeof payload?.itemId === 'string' && typeof payload?.isChecked === 'boolean';

            case 'UPDATE_ITEM':
                return typeof payload?.itemId === 'string' && typeof payload?.updates === 'object';

            case 'ADD_ITEM':
                return typeof payload?.item === 'object' && payload.item !== null;

            case 'BATCH_CHECK':
                return Array.isArray(payload?.itemIds) && typeof payload?.isChecked === 'boolean';

            case 'BATCH_DELETE':
                return Array.isArray(payload?.itemIds) && payload.itemIds.length > 0;

            case 'REORDER_ITEMS':
                return Array.isArray(payload?.updates);

            default:
                return false;
        }
    };

    // Execute a single mutation against the server
    const executeMutation = async (mutation: PendingMutation): Promise<void> => {
        const { type, payload } = mutation;

        // Validate payload before execution
        if (!validatePayload(mutation)) {
            throw new Error(`Invalid payload for mutation type: ${type}`);
        }

        switch (type) {
            case 'DELETE_ITEM':
                await shoppingListService.deleteItem(payload.itemId);
                break;

            case 'CHECK_ITEM':
                await shoppingListService.toggleItemChecked(payload.itemId, payload.isChecked);
                break;

            case 'UPDATE_ITEM':
                await shoppingListService.updateItem(payload.itemId, payload.updates);
                break;

            case 'ADD_ITEM':
                await shoppingListService.addItem(payload.item);
                break;

            case 'BATCH_CHECK':
                await shoppingListService.batchUpdateItems(payload.itemIds, { isChecked: payload.isChecked });
                break;

            case 'BATCH_DELETE':
                await shoppingListService.batchDeleteItems(payload.itemIds);
                break;

            case 'REORDER_ITEMS':
                await shoppingListService.updateItemsOrder(payload.updates);
                break;

            default:
                console.warn(`Unknown mutation type: ${type}`);
        }
    };

    // Sync pending mutations
    const syncNow = useCallback(async () => {
        if (isSyncing || isOffline) return;

        const count = await mutationQueue.getCount();
        if (count === 0) return;

        setIsSyncing(true);

        try {
            const result = await mutationQueue.processAll(executeMutation);

            await refreshPendingCount();

            if (result.success > 0) {
                toast.showSuccess(i18n.t('shoppingList.syncComplete'));
                onSyncComplete?.();
            }

            if (result.failed > 0) {
                toast.showWarning(
                    i18n.t('shoppingList.syncPartial'),
                    i18n.t('shoppingList.syncPartialDesc', { count: result.failed })
                );
            }
        } catch (error) {
            console.error('Sync failed:', error);
            toast.showError(i18n.t('common.error'), i18n.t('shoppingList.syncError'));
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing, isOffline, toast, onSyncComplete, refreshPendingCount]);

    // Queue a mutation
    const queueMutation = useCallback(async <T extends MutationType>(type: T, payload: MutationPayloads[T]): Promise<string> => {
        const id = await mutationQueue.enqueue(type, payload);
        await refreshPendingCount();
        return id;
    }, [refreshPendingCount]);

    // Load initial pending count
    useEffect(() => {
        refreshPendingCount();
    }, [refreshPendingCount]);

    // Auto-sync when coming back online
    useEffect(() => {
        if (autoSync && wasOfflineRef.current && isConnected) {
            // Was offline, now online - sync
            syncNow();
        }
        wasOfflineRef.current = !isConnected;
    }, [isConnected, autoSync, syncNow]);

    return {
        isOffline,
        isSyncing,
        pendingCount,
        syncNow,
        queueMutation,
        refreshPendingCount,
    };
}

export default useOfflineSync;
