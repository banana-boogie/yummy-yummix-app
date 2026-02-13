/**
 * useOfflineSync Tests
 *
 * Validates queueing and sync behavior.
 */

import { renderHook, act, waitFor } from '@/test/utils/render';
import { useOfflineSync } from '../useOfflineSync';
import { supabase } from '@/lib/supabase';

let mockToast: { showSuccess: jest.Mock; showWarning: jest.Mock; showError: jest.Mock };
let mockMutationQueue: {
  getCount: jest.Mock;
  enqueue: jest.Mock;
  processAll: jest.Mock;
  setNamespace: jest.Mock;
};
let mockIsConnected = true;
let authStateChangeHandler: ((event: string, session: { user: { id?: string } | null } | null) => void | Promise<void>) | undefined;

jest.mock('@/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: mockIsConnected, isInternetReachable: true, type: 'wifi' }),
}));

jest.mock('@/services/offlineQueue/mutationQueue', () => ({
  __esModule: true,
  mutationQueue: (() => {
    mockMutationQueue = {
      getCount: jest.fn(),
      enqueue: jest.fn(),
      processAll: jest.fn(),
      setNamespace: jest.fn(),
    };
    return mockMutationQueue;
  })(),
}));

describe('useOfflineSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsConnected = true;
    authStateChangeHandler = undefined;
    mockToast = {
      showSuccess: jest.fn(),
      showWarning: jest.fn(),
      showError: jest.fn(),
    };

    (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
      authStateChangeHandler = callback;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });
  });

  it('queues a mutation and refreshes pending count', async () => {
    mockMutationQueue.getCount.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    mockMutationQueue.enqueue.mockResolvedValue('mutation-1');

    const { result } = renderHook(() => useOfflineSync({ autoSync: false }));

    await act(async () => {
      await result.current.queueMutation('DELETE_ITEM', { itemId: 'item-1' });
    });

    expect(mockMutationQueue.enqueue).toHaveBeenCalledWith('DELETE_ITEM', { itemId: 'item-1' });
    expect(result.current.pendingCount).toBe(1);
  });

  it('syncs pending mutations and shows success toast', async () => {
    mockMutationQueue.getCount.mockResolvedValue(1);
    mockMutationQueue.processAll.mockResolvedValue({ success: 1, failed: 0 });

    const { result } = renderHook(() => useOfflineSync({ autoSync: false }));

    await act(async () => {
      await result.current.syncNow();
    });

    expect(mockMutationQueue.processAll).toHaveBeenCalled();
    expect(mockToast.showSuccess).toHaveBeenCalled();
  });

  it('auto-syncs pending mutations on startup when online', async () => {
    mockMutationQueue.getCount.mockResolvedValue(1);
    mockMutationQueue.processAll.mockResolvedValue({ success: 1, failed: 0 });

    renderHook(() => useOfflineSync());

    await waitFor(() => {
      expect(mockMutationQueue.processAll).toHaveBeenCalledTimes(1);
    });
    expect(mockToast.showSuccess).toHaveBeenCalled();
  });

  it('does not auto-sync on startup when there are no pending mutations', async () => {
    mockMutationQueue.getCount.mockResolvedValue(0);

    renderHook(() => useOfflineSync());

    await waitFor(() => {
      expect(mockMutationQueue.getCount).toHaveBeenCalled();
    });
    expect(mockMutationQueue.processAll).not.toHaveBeenCalled();
  });

  it('does not run duplicate startup auto-sync for the same namespace', async () => {
    mockMutationQueue.getCount.mockResolvedValue(1);
    mockMutationQueue.processAll.mockResolvedValue({ success: 1, failed: 0 });

    renderHook(() => useOfflineSync());

    await waitFor(() => {
      expect(mockMutationQueue.processAll).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await authStateChangeHandler?.('TOKEN_REFRESHED', { user: null });
    });

    await waitFor(() => {
      expect(mockMutationQueue.processAll).toHaveBeenCalledTimes(1);
    });
  });
});
