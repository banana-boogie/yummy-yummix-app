import { act, renderHook, waitFor } from '@/test/utils/render';
import { useShoppingListData } from '../useShoppingListData';
import { shoppingListFactory } from '@/test/factories';
import { shoppingListService } from '@/services/shoppingListService';

let mockQueueMutation: jest.Mock;
let mockQueueDeletion: jest.Mock;

jest.mock('@/hooks/useOfflineSync', () => ({
  useOfflineSync: () => ({
    isOffline: false,
    isSyncing: false,
    pendingCount: 0,
    queueMutation: mockQueueMutation,
  }),
}));

jest.mock('@/hooks/useUndoableDelete', () => ({
  useUndoableDelete: () => ({
    queueDeletion: mockQueueDeletion,
  }),
}));

describe('useShoppingListData fetch stability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueMutation = jest.fn();
    mockQueueDeletion = jest.fn();
  });

  it('does not refetch after the initial load solely due to toast identity', async () => {
    const list = shoppingListFactory.createWithItems({}, 1, 1);
    const categories = list.categories.map(({ items, localizedName, ...category }) => category);
    const getListSpy = jest
      .spyOn(shoppingListService, 'getShoppingListById')
      .mockImplementation(async () => JSON.parse(JSON.stringify(list)));
    jest
      .spyOn(shoppingListService, 'getCategories')
      .mockImplementation(async () => JSON.parse(JSON.stringify(categories)));

    const { result } = renderHook(() => useShoppingListData({ listId: list.id }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(getListSpy).toHaveBeenCalledTimes(1);
  });
});
