import { useState, useEffect, useCallback, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { mutationQueue, MutationType, MutationPayloads, PendingMutation } from '@/services/offlineQueue/mutationQueue';
import { shoppingListService } from '@/services/shoppingListService';
import { useToast } from './useToast';
import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';

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
 * const handleDelete = async (itemId: string, listId: string) => {
 *   if (isOffline) {
 *     await queueMutation('DELETE_ITEM', { itemId, listId });
 *   } else {
 *     await shoppingListService.deleteItem(itemId, listId);
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
    const syncNowRef = useRef<() => Promise<void>>(async () => { });
    const autoSyncRef = useRef(autoSync);
    const isConnectedRef = useRef(isConnected);
    const initialAutoSyncNamespaceRef = useRef<string | null>(null);

    const isOffline = !isConnected;

    // Refresh pending count
    const refreshPendingCount = useCallback(async () => {
        const count = await mutationQueue.getCount();
        setPendingCount(count);
    }, []);

    // Validate payload structure for a mutation
    const validatePayload = useCallback((mutation: PendingMutation): boolean => {
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
    }, []);

    // Execute a single mutation against the server
    const executeMutation = useCallback(async (mutation: PendingMutation): Promise<void> => {
        const { type, payload } = mutation;

        // Validate payload before execution
        if (!validatePayload(mutation)) {
            throw new Error(`Invalid payload for mutation type: ${type}`);
        }

        switch (type) {
            case 'DELETE_ITEM':
                await shoppingListService.deleteItem(payload.itemId, payload.listId);
                break;

            case 'CHECK_ITEM':
                await shoppingListService.toggleItemChecked(payload.itemId, payload.isChecked, payload.listId);
                break;

            case 'UPDATE_ITEM':
                await shoppingListService.updateItem(payload.itemId, payload.updates, payload.listId);
                break;

            case 'ADD_ITEM':
                await shoppingListService.addItem(payload.item);
                break;

            case 'BATCH_CHECK':
                await shoppingListService.batchUpdateItems(payload.itemIds, { isChecked: payload.isChecked }, payload.listId);
                break;

            case 'BATCH_DELETE':
                await shoppingListService.batchDeleteItems(payload.itemIds, payload.listId);
                break;

            case 'REORDER_ITEMS':
                await shoppingListService.updateItemsOrder(payload.updates, payload.listId);
                break;

            default:
                console.warn(`Unknown mutation type: ${type}`);
        }
    }, [validatePayload]);

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
            toast.showError(i18n.t('common.errors.title'), i18n.t('shoppingList.syncError'));
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing, isOffline, toast, onSyncComplete, refreshPendingCount, executeMutation]);

    // Queue a mutation
    const queueMutation = useCallback(async <T extends MutationType>(type: T, payload: MutationPayloads[T]): Promise<string> => {
        const id = await mutationQueue.enqueue(type, payload);
        await refreshPendingCount();
        return id;
    }, [refreshPendingCount]);

    useEffect(() => {
        syncNowRef.current = syncNow;
    }, [syncNow]);

    useEffect(() => {
        autoSyncRef.current = autoSync;
    }, [autoSync]);

    useEffect(() => {
        isConnectedRef.current = isConnected;
    }, [isConnected]);

    // Initialize queue namespace based on current user and keep in sync on auth changes
    useEffect(() => {
        let isMounted = true;

        const maybeRunInitialAutoSync = async (namespace?: string | null) => {
            const normalizedNamespace = namespace ?? 'anon';

            // Only run once per namespace to avoid duplicate startup sync calls.
            if (initialAutoSyncNamespaceRef.current === normalizedNamespace) return;
            if (!autoSyncRef.current || !isConnectedRef.current) return;

            initialAutoSyncNamespaceRef.current = normalizedNamespace;
            await syncNowRef.current();
        };

        const initNamespace = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            const namespace = user?.id ?? null;
            mutationQueue.setNamespace(namespace);
            if (isMounted) {
                await refreshPendingCount();
                await maybeRunInitialAutoSync(namespace);
            }
        };

        initNamespace();

        const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!isMounted) return;

            const namespace = session?.user?.id ?? null;
            mutationQueue.setNamespace(namespace);
            await refreshPendingCount();
            await maybeRunInitialAutoSync(namespace);
        });

        return () => {
            isMounted = false;
            data.subscription.unsubscribe();
        };
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
