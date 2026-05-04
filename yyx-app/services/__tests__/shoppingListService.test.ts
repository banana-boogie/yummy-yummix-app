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
      p_list_id: 'list-1',
      updates: [
        { id: 'item-1', display_order: 2 },
        { id: 'item-2', display_order: 1 },
      ],
    });
  });

  it('combines duplicate recipe ingredient updates before writing quantities', async () => {
    const user = userFactory.createSupabaseUser({ id: 'user-123' });
    mockSupabaseAuthSuccess(user);

    const mockClient = getMockSupabaseClient();
    const updateCalls: Array<{ quantity: number; id?: string }> = [];

    mockClient.from.mockImplementation((table: string) => {
      const state: { op: 'select' | 'insert' | 'update'; value?: Record<string, unknown> } = {
        op: 'select',
      };
      const builder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn((column: string, value: string) => {
          if (state.op === 'update' && column === 'id') {
            updateCalls.push({
              quantity: state.value?.quantity as number,
              id: value,
            });
          }
          return builder;
        }),
        in: jest.fn().mockReturnThis(),
        insert: jest.fn((value: Record<string, unknown>[]) => {
          state.op = 'insert';
          state.value = { value };
          return builder;
        }),
        update: jest.fn((value: Record<string, unknown>) => {
          state.op = 'update';
          state.value = value;
          return builder;
        }),
        then: jest.fn((resolve) => {
          if (table === 'shopping_list_items' && state.op === 'select') {
            resolve({
              data: [{
                id: 'existing-item',
                ingredient_id: 'ingredient-1',
                unit_id: 'g',
                quantity: '2',
              }],
              error: null,
            });
            return;
          }
          if (table === 'ingredients') {
            resolve({
              data: [{ id: 'ingredient-1', default_category_id: 'produce' }],
              error: null,
            });
            return;
          }
          resolve({ data: null, error: null });
        }),
      };
      return builder;
    });

    await shoppingListService.addRecipeIngredients('list-1', [
      { ingredientId: 'ingredient-1', quantity: 3, unitId: 'g' },
      { ingredientId: 'ingredient-1', quantity: 4, unitId: 'g' },
    ]);

    expect(updateCalls).toEqual([{ id: 'existing-item', quantity: 9 }]);
  });
});
