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

  it('ignores stale fetch results when listId changes mid-flight', async () => {
    const listA = shoppingListFactory.createWithItems({ id: 'list-a', name: 'List A' }, 1, 1);
    const listB = shoppingListFactory.createWithItems({ id: 'list-b', name: 'List B' }, 1, 1);
    const categoriesB = listB.categories.map(({ items, localizedName, ...category }) => category);
    let resolveListA: (value: typeof listA) => void = () => undefined;
    let resolveListB: (value: typeof listB) => void = () => undefined;

    jest
      .spyOn(shoppingListService, 'getShoppingListById')
      .mockImplementation((id: string) => {
        if (id === listA.id) {
          return new Promise(resolve => {
            resolveListA = resolve;
          });
        }
        return new Promise(resolve => {
          resolveListB = resolve;
        });
      });
    jest
      .spyOn(shoppingListService, 'getCategories')
      .mockResolvedValue(categoriesB);

    const { result, rerender } = renderHook(
      ({ id }) => useShoppingListData({ listId: id }),
      { initialProps: { id: listA.id } }
    );

    rerender({ id: listB.id });

    await act(async () => {
      resolveListB(listB);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.list?.id).toBe(listB.id);
    });

    await act(async () => {
      resolveListA(listA);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.list?.id).toBe(listB.id);
  });
});
