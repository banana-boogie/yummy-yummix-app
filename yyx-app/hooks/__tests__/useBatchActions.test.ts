/**
 * useBatchActions Tests
 *
 * Validates offline batch check behavior.
 */

import { renderHook, act } from '@/test/utils/render';
import { useBatchActions } from '../useBatchActions';
import { shoppingListFactory } from '@/test/factories';

jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
  }),
}));

jest.mock('@/hooks/useUndoableDelete', () => ({
  useUndoableDelete: () => ({
    queueDeletion: jest.fn(),
  }),
}));

describe('useBatchActions', () => {
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
});

