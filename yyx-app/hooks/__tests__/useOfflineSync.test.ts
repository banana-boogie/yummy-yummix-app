/**
 * useOfflineSync Tests
 *
 * Validates queueing and sync behavior.
 */

let mockToast: { showSuccess: jest.Mock; showWarning: jest.Mock; showError: jest.Mock };
let mockMutationQueue: {
  getCount: jest.Mock;
  enqueue: jest.Mock;
  processAll: jest.Mock;
  setNamespace: jest.Mock;
};

jest.mock('@/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' }),
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

import { renderHook, act } from '@/test/utils/render';
import { useOfflineSync } from '../useOfflineSync';

describe('useOfflineSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToast = {
      showSuccess: jest.fn(),
      showWarning: jest.fn(),
      showError: jest.fn(),
    };
  });

  it('queues a mutation and refreshes pending count', async () => {
    mockMutationQueue.getCount.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    mockMutationQueue.enqueue.mockResolvedValue('mutation-1');

    const { result } = renderHook(() => useOfflineSync());

    await act(async () => {
      await result.current.queueMutation('DELETE_ITEM', { itemId: 'item-1' });
    });

    expect(mockMutationQueue.enqueue).toHaveBeenCalledWith('DELETE_ITEM', { itemId: 'item-1' });
    expect(result.current.pendingCount).toBe(1);
  });

  it('syncs pending mutations and shows success toast', async () => {
    mockMutationQueue.getCount.mockResolvedValue(1);
    mockMutationQueue.processAll.mockResolvedValue({ success: 1, failed: 0 });

    const { result } = renderHook(() => useOfflineSync());

    await act(async () => {
      await result.current.syncNow();
    });

    expect(mockMutationQueue.processAll).toHaveBeenCalled();
    expect(mockToast.showSuccess).toHaveBeenCalled();
  });
});
