import { useCallback } from 'react';
import type { MutationType, MutationPayloads } from '@/services/offlineQueue/mutationQueue';

interface UseOfflineSyncOptions {
  onSyncComplete?: () => void;
  autoSync?: boolean;
}

interface UseOfflineSyncReturn {
  isOffline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  syncNow: () => Promise<void>;
  queueMutation: <T extends MutationType>(type: T, payload: MutationPayloads[T]) => Promise<string>;
  refreshPendingCount: () => Promise<void>;
}

// Offline sync is disabled in the current port. This is a no-op stub that
// preserves the hook surface so dependent components still compile. Callers
// always see isOffline=false and queueMutation is a no-op.
export function useOfflineSync(_options: UseOfflineSyncOptions = {}): UseOfflineSyncReturn {
  const syncNow = useCallback(async () => {}, []);
  const queueMutation = useCallback(
    async <T extends MutationType>(_type: T, _payload: MutationPayloads[T]): Promise<string> => '',
    [],
  );
  const refreshPendingCount = useCallback(async () => {}, []);

  return {
    isOffline: false,
    isSyncing: false,
    pendingCount: 0,
    syncNow,
    queueMutation,
    refreshPendingCount,
  };
}

export default useOfflineSync;
