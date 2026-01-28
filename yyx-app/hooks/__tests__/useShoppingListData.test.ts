/**
 * useShoppingListData Tests
 *
 * Validates offline add behavior.
 */

let mockQueueMutation: jest.Mock;

jest.mock('@/hooks/useOfflineSync', () => ({
  useOfflineSync: () => ({
    isOffline: true,
    isSyncing: false,
    pendingCount: 0,
    queueMutation: mockQueueMutation,
  }),
}));

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

import { renderHook, act, waitFor } from '@/test/utils/render';
import { useShoppingListData } from '../useShoppingListData';
import { shoppingListFactory } from '@/test/factories';
import { shoppingListService } from '@/services/shoppingListService';

describe('useShoppingListData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueMutation = jest.fn().mockResolvedValue('mutation-1');
  });

  it('queues offline add item mutations', async () => {
    const list = shoppingListFactory.createWithItems({}, 1, 1);
    const categories = [shoppingListFactory.createCategory({ id: 'other' })];

    jest.spyOn(shoppingListService, 'getShoppingListById').mockResolvedValue(list);
    jest.spyOn(shoppingListService, 'getCategories').mockResolvedValue(categories);
    const addSpy = jest.spyOn(shoppingListService, 'addItem');

    const { result } = renderHook(() =>
      useShoppingListData({ listId: list.id })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleAddItem({
        nameCustom: 'Apples',
        categoryId: 'other',
        quantity: 1,
      });
    });

    expect(mockQueueMutation).toHaveBeenCalledWith('ADD_ITEM', {
      item: {
        nameCustom: 'Apples',
        categoryId: 'other',
        quantity: 1,
        shoppingListId: list.id,
      },
      listId: list.id,
    });
    expect(addSpy).not.toHaveBeenCalled();
  });
});
