/**
 * useBatchActions Tests
 *
 * Validates offline batch check behavior.
 */

import { renderHook, act, waitFor } from '@/test/utils/render';
import { useBatchActions } from '../useBatchActions';
import { shoppingListFactory } from '@/test/factories';
import { shoppingListService } from '@/services/shoppingListService';
import i18n from '@/i18n';

let mockToast: { showSuccess: jest.Mock; showError: jest.Mock };
let mockQueueDeletion: jest.Mock;
let capturedBatchDeleteOnError: ((items: unknown, error: Error) => void) | undefined;

jest.mock('@/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

jest.mock('@/hooks/useUndoableDelete', () => ({
  useUndoableDelete: (_getItemId: unknown, options?: { onError?: (item: unknown, error: Error) => void }) => {
    capturedBatchDeleteOnError = options?.onError;
    return {
      queueDeletion: mockQueueDeletion,
    };
  },
}));

describe('useBatchActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToast = {
      showSuccess: jest.fn(),
      showError: jest.fn(),
    };
    mockQueueDeletion = jest.fn();
    capturedBatchDeleteOnError = undefined;
  });

  it('queues batch check when offline', async () => {
    const list = shoppingListFactory.createWithItems({}, 1, 2);
    const selectedItems = new Set(list.items.map((item) => item.id));
    const queueMutation = jest.fn().mockResolvedValue('batch-1');
    const setList = jest.fn();
    const clearSelection = jest.fn();

    const { result } = renderHook(() =>
      useBatchActions({
        list,
        setList,
        selectedItems,
        clearSelection,
        isOffline: true,
        queueMutation,
        categories: list.categories,
      })
    );

    await act(async () => {
      await result.current.handleBatchCheck();
    });

    expect(queueMutation).toHaveBeenCalledWith('BATCH_CHECK', {
      itemIds: Array.from(selectedItems),
      isChecked: true,
      listId: list.id,
    });
  });

  it('shows an error and refreshes list when batch delete commit fails', async () => {
    const list = shoppingListFactory.createWithItems({}, 1, 2);
    const selectedItems = new Set([list.items[0].id]);
    const queueMutation = jest.fn().mockResolvedValue('batch-1');
    const setList = jest.fn();
    const clearSelection = jest.fn();
    const categories = list.categories.map(({ items, localizedName, ...category }) => category);
    const latestList = shoppingListFactory.createWithItems({ id: list.id }, 1, 1);
    const getListSpy = jest.spyOn(shoppingListService, 'getShoppingListById').mockResolvedValue(latestList);

    const { result } = renderHook(() =>
      useBatchActions({
        list,
        setList,
        selectedItems,
        clearSelection,
        isOffline: false,
        queueMutation,
        categories,
      })
    );

    await act(async () => {
      await result.current.handleBatchDeleteConfirm();
    });

    expect(mockQueueDeletion).toHaveBeenCalled();
    expect(capturedBatchDeleteOnError).toBeDefined();

    act(() => {
      capturedBatchDeleteOnError?.([], new Error('commit failed'));
    });

    await waitFor(() => {
      expect(mockToast.showError).toHaveBeenCalledWith(
        i18n.t('common.errors.title'),
        i18n.t('shoppingList.batchError')
      );
    });
    await waitFor(() => {
      expect(getListSpy).toHaveBeenCalledWith(list.id, false);
    });
    await waitFor(() => {
      expect(setList).toHaveBeenCalledWith(latestList);
    });
  });
});
