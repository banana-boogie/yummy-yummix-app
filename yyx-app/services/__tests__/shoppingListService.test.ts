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

  describe('searchIngredientsLocal', () => {
    const fixtures = [
      { id: '1', name: 'Banana', pluralName: 'Bananas', categoryId: 'produce' },
      { id: '2', name: 'Plantain', pluralName: 'Plantains', categoryId: 'produce' },
      { id: '3', name: 'Apple', pluralName: 'Apples', categoryId: 'produce' },
      { id: '4', name: 'Brown sugar', categoryId: 'baking' },
    ];

    it('matches plural names so "bananas" finds the canonical "banana" row', () => {
      const results = shoppingListService.searchIngredientsLocal('bananas', fixtures);
      expect(results.map((r) => r.id)).toEqual(['1']);
    });

    it('case-insensitive contains match', () => {
      const results = shoppingListService.searchIngredientsLocal('PLAN', fixtures);
      expect(results.map((r) => r.id)).toEqual(['2']);
    });

    it('sorts starts-with matches before contains matches', () => {
      const rows = [
        { id: 'a', name: 'Strawberry', categoryId: 'produce' },
        { id: 'b', name: 'Berry', categoryId: 'produce' },
      ];
      const results = shoppingListService.searchIngredientsLocal('berry', rows);
      // "Berry" starts with the query — it should rank above "Strawberry".
      expect(results.map((r) => r.id)).toEqual(['b', 'a']);
    });

    it('honours the limit argument', () => {
      const many = Array.from({ length: 25 }, (_, i) => ({
        id: `i${i}`,
        name: `apple${i}`,
        categoryId: 'produce',
      }));
      const results = shoppingListService.searchIngredientsLocal('apple', many, 5);
      expect(results).toHaveLength(5);
    });

    it('returns empty array for blank query', () => {
      expect(shoppingListService.searchIngredientsLocal('   ', fixtures)).toEqual([]);
    });
  });

  describe('getAllIngredients', () => {
    it('caches results so a second call does not hit the network', async () => {
      const user = userFactory.createSupabaseUser({ id: 'user-cache' });
      mockSupabaseAuthSuccess(user);

      const mockClient = getMockSupabaseClient();
      let fromCalls = 0;
      mockClient.from.mockImplementation((table: string) => {
        if (table === 'ingredient_translations') fromCalls += 1;
        const builder: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          then: jest.fn((resolve: any) =>
            resolve({
              data: [
                {
                  ingredient_id: 'ing-1',
                  name: 'Banana',
                  plural_name: 'Bananas',
                  ingredient: { id: 'ing-1', image_url: null, default_category_id: 'produce' },
                },
              ],
              error: null,
            }),
          ),
        };
        return builder;
      });

      // Force cache reset via useCache=false on the first call (in case a
      // prior test populated the module cache).
      const first = await shoppingListService.getAllIngredients(false);
      const second = await shoppingListService.getAllIngredients();

      expect(first).toEqual(second);
      expect(first[0]).toMatchObject({
        id: 'ing-1',
        name: 'Banana',
        pluralName: 'Bananas',
        categoryId: 'produce',
      });
      // Only the first call should have hit ingredient_translations.
      expect(fromCalls).toBe(1);
    });
  });
});
