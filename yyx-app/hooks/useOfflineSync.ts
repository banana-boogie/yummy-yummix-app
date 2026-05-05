import { useState, useEffect, useCallback, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { mutationQueue, MutationType, MutationPayloads, PendingMutation } from '@/services/offlineQueue/mutationQueue';
import { shoppingListService } from '@/services/shoppingListService';
import { useToast } from './useToast';
import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';
import { logger } from '@/services/logger';

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
    const isSyncingRef = useRef(false);
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

    // Validate payload structure for a mutation. We re-narrow inside each
    // case because `mutation.payload` is the union — TS can't follow the
    // discriminator after destructuring.
    const validatePayload = useCallback((mutation: PendingMutation): boolean => {
        const p = mutation.payload as Record<string, unknown>;
        switch (mutation.type) {
            case 'DELETE_ITEM':
                return typeof p?.itemId === 'string' && (p.itemId as string).length > 0;
            case 'CHECK_ITEM':
                return typeof p?.itemId === 'string' && typeof p?.isChecked === 'boolean';
            case 'UPDATE_ITEM':
                return typeof p?.itemId === 'string' && typeof p?.updates === 'object';
            case 'ADD_ITEM':
                return typeof p?.item === 'object' && p.item !== null;
            case 'BATCH_CHECK':
                return Array.isArray(p?.itemIds) && typeof p?.isChecked === 'boolean';
            case 'BATCH_DELETE':
                return Array.isArray(p?.itemIds) && (p.itemIds as unknown[]).length > 0;
            default:
                return false;
        }
    }, []);

    // Execute a single mutation against the server
    const executeMutation = useCallback(async (mutation: PendingMutation): Promise<void> => {
        if (!validatePayload(mutation)) {
            throw new Error(`Invalid payload for mutation type: ${mutation.type}`);
        }

        switch (mutation.type) {
            case 'DELETE_ITEM': {
                const p = mutation.payload as MutationPayloads['DELETE_ITEM'];
                await shoppingListService.deleteItem(p.itemId, p.listId);
                break;
            }
            case 'CHECK_ITEM': {
                const p = mutation.payload as MutationPayloads['CHECK_ITEM'];
                await shoppingListService.toggleItemChecked(p.itemId, p.isChecked, p.listId);
                break;
            }
            case 'UPDATE_ITEM': {
                const p = mutation.payload as MutationPayloads['UPDATE_ITEM'];
                await shoppingListService.updateItem(p.itemId, p.updates, p.listId);
                break;
            }
            case 'ADD_ITEM': {
                const p = mutation.payload as MutationPayloads['ADD_ITEM'];
                await shoppingListService.addItem(p.item);
                break;
            }
            case 'BATCH_CHECK': {
                const p = mutation.payload as MutationPayloads['BATCH_CHECK'];
                await shoppingListService.batchUpdateItems(p.itemIds, { isChecked: p.isChecked }, p.listId);
                break;
            }
            case 'BATCH_DELETE': {
                const p = mutation.payload as MutationPayloads['BATCH_DELETE'];
                await shoppingListService.batchDeleteItems(p.itemIds, p.listId);
                break;
            }
            default:
                logger.warn(`Unknown mutation type: ${mutation.type}`);
        }
    }, [validatePayload]);

    // Sync pending mutations
    const syncNow = useCallback(async () => {
        if (isSyncingRef.current || isOffline) return;
        isSyncingRef.current = true;

        const count = await mutationQueue.getCount();
        if (count === 0) {
            isSyncingRef.current = false;
            return;
        }

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
            logger.error('Sync failed:', error);
            toast.showError(i18n.t('common.errors.title'), i18n.t('shoppingList.syncError'));
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
        }
    }, [isOffline, toast, onSyncComplete, refreshPendingCount, executeMutation]);

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
