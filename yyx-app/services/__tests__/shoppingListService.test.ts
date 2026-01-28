/**
 * shoppingListService Tests
 *
 * Covers cache usage and batch reorder RPC.
 */

import { shoppingListService } from '../shoppingListService';
import { shoppingListsSummaryCache } from '../cache/shoppingListCache';
import { shoppingListFactory, userFactory } from '@/test/factories';
import { getMockSupabaseClient, mockSupabaseAuthSuccess } from '@/test/mocks/supabase';

describe('shoppingListService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns cached lists scoped to user', async () => {
    const user = userFactory.createSupabaseUser({ id: 'user-123' });
    mockSupabaseAuthSuccess(user);

    const cachedLists = shoppingListFactory.createList(2);
    const cacheSpy = jest
      .spyOn(shoppingListsSummaryCache, 'getLists')
      .mockResolvedValue(cachedLists);

    const result = await shoppingListService.getShoppingLists();

    expect(cacheSpy).toHaveBeenCalledWith(false, 'user-123');
    expect(result).toEqual(cachedLists);
  });

  it('uses RPC to update item order', async () => {
    const mockClient = getMockSupabaseClient();
    mockClient.rpc.mockResolvedValue({ data: null, error: null });

    await shoppingListService.updateItemsOrder([
      { id: 'item-1', displayOrder: 2 },
      { id: 'item-2', displayOrder: 1 },
    ], 'list-1');

    expect(mockClient.rpc).toHaveBeenCalledWith('update_shopping_list_item_orders', {
      updates: [
        { id: 'item-1', display_order: 2 },
        { id: 'item-2', display_order: 1 },
      ],
    });
  });
});

