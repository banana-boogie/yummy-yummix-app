/**
 * useShoppingListData Tests
 *
 * Validates offline add behavior.
 */

import { renderHook, act, waitFor } from '@/test/utils/render';
import { useShoppingListData } from '../useShoppingListData';
import { shoppingListFactory } from '@/test/factories';
import { shoppingListService } from '@/services/shoppingListService';
import i18n from '@/i18n';

let mockQueueMutation: jest.Mock;
let mockQueueDeletion: jest.Mock;
let capturedDeleteOnError: ((item: unknown, error: Error) => void) | undefined;
let mockToast: { showSuccess: jest.Mock; showError: jest.Mock };

jest.mock('@/hooks/useOfflineSync', () => ({
  useOfflineSync: () => ({
    isOffline: true,
    isSyncing: false,
    pendingCount: 0,
    queueMutation: mockQueueMutation,
  }),
}));

jest.mock('@/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

jest.mock('@/hooks/useUndoableDelete', () => ({
  useUndoableDelete: (_getItemId: unknown, options?: { onError?: (item: unknown, error: Error) => void }) => {
    capturedDeleteOnError = options?.onError;
    return {
      queueDeletion: mockQueueDeletion,
    };
  },
}));

describe('useShoppingListData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueMutation = jest.fn().mockResolvedValue('mutation-1');
    mockQueueDeletion = jest.fn();
    capturedDeleteOnError = undefined;
    mockToast = {
      showSuccess: jest.fn(),
      showError: jest.fn(),
    };
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

  it('shows an error and refetches when delete commit fails after timeout', async () => {
    const list = shoppingListFactory.createWithItems({}, 1, 1);
    const categories = list.categories.map(({ items, localizedName, ...category }) => category);
    const itemToDelete = list.items[0];

    const getListSpy = jest.spyOn(shoppingListService, 'getShoppingListById').mockResolvedValue(list);
    jest.spyOn(shoppingListService, 'getCategories').mockResolvedValue(categories);

    const { result } = renderHook(() =>
      useShoppingListData({ listId: list.id })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.handleDeleteItem(itemToDelete.id);
    });

    expect(mockQueueDeletion).toHaveBeenCalled();
    expect(capturedDeleteOnError).toBeDefined();

    act(() => {
      capturedDeleteOnError?.(itemToDelete, new Error('commit failed'));
    });

    await waitFor(() => {
      expect(mockToast.showError).toHaveBeenCalledWith(
        i18n.t('common.errors.title'),
        i18n.t('common.errors.default')
      );
    });
    await waitFor(() => {
      expect(getListSpy).toHaveBeenLastCalledWith(list.id, false);
    });
  });
});
