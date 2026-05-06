/**
 * useShoppingListData Tests
 *
 * Validates offline add behavior.
 */

import { renderHook, act, waitFor } from '@/test/utils/render';
import { useShoppingListData } from '../useShoppingListData';
import { createMeasurementUnit, shoppingListFactory } from '@/test/factories';
import { shoppingListService } from '@/services/shoppingListService';
import i18n from '@/i18n';

let mockQueueMutation: jest.Mock;
let mockQueueDeletion: jest.Mock;
let capturedDeleteOnError: ((item: unknown, error: Error) => void) | undefined;
let mockToast: { showError: jest.Mock };
let mockIsOffline: boolean;

jest.mock('@/hooks/useOfflineSync', () => ({
  useOfflineSync: () => ({
    isOffline: mockIsOffline,
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
    mockIsOffline = true;
    mockToast = {
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

  it('persists edit names and units online while updating the optimistic row', async () => {
    mockIsOffline = false;
    const oldUnit = createMeasurementUnit({ id: 'unit-old', name: 'gram', symbol: 'g' });
    const newUnit = createMeasurementUnit({ id: 'unit-new', name: 'kilogram', symbol: 'kg' });
    const list = shoppingListFactory.createWithItems({}, 1, 1);
    const category = list.categories[0];
    const originalItem = category.items[0];
    const item = {
      ...originalItem,
      id: 'item-1',
      name: 'Flour',
      quantity: 1,
      unit: oldUnit,
      categoryId: category.id,
    };
    const listWithUnit = {
      ...list,
      items: [item],
      categories: [{ ...category, items: [item] }],
    };
    const categories = listWithUnit.categories.map(({ items, localizedName, ...cat }) => cat);

    jest.spyOn(shoppingListService, 'getShoppingListById').mockResolvedValue(listWithUnit);
    jest.spyOn(shoppingListService, 'getCategories').mockResolvedValue(categories);
    jest.spyOn(shoppingListService, 'getMeasurementUnits').mockResolvedValue([oldUnit, newUnit]);
    const updateSpy = jest.spyOn(shoppingListService, 'updateItem').mockResolvedValue();

    const { result } = renderHook(() =>
      useShoppingListData({ listId: listWithUnit.id })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleEditItem(item.id, {
        nameCustom: 'Bread flour',
        quantity: 2,
        unitId: newUnit.id,
        categoryId: category.id,
        notes: 'Organic',
      });
    });

    expect(updateSpy).toHaveBeenCalledWith(item.id, {
      nameCustom: 'Bread flour',
      quantity: 2,
      unitId: newUnit.id,
      categoryId: category.id,
      notes: 'Organic',
    }, listWithUnit.id);

    const edited = result.current.list?.categories[0].items[0];
    expect(edited).toMatchObject({
      name: 'Bread flour',
      quantity: 2,
      notes: 'Organic',
      unit: newUnit,
    });
  });

  it('preserves null unit updates so clearing a unit can sync', async () => {
    const unit = createMeasurementUnit({ id: 'unit-old', name: 'gram', symbol: 'g' });
    const list = shoppingListFactory.createWithItems({}, 1, 1);
    const category = list.categories[0];
    const item = {
      ...category.items[0],
      id: 'item-clear-unit',
      unit,
      categoryId: category.id,
    };
    const listWithUnit = {
      ...list,
      items: [item],
      categories: [{ ...category, items: [item] }],
    };
    const categories = listWithUnit.categories.map(({ items, localizedName, ...cat }) => cat);

    jest.spyOn(shoppingListService, 'getShoppingListById').mockResolvedValue(listWithUnit);
    jest.spyOn(shoppingListService, 'getCategories').mockResolvedValue(categories);

    const { result } = renderHook(() =>
      useShoppingListData({ listId: listWithUnit.id })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleEditItem(item.id, {
        unitId: null,
        categoryId: category.id,
      });
    });

    expect(mockQueueMutation).toHaveBeenCalledWith('UPDATE_ITEM', {
      itemId: item.id,
      updates: {
        nameCustom: undefined,
        quantity: undefined,
        unitId: null,
        categoryId: category.id,
        notes: undefined,
      },
      listId: listWithUnit.id,
    });
    expect(result.current.list?.categories[0].items[0].unit).toBeUndefined();
  });

  it('clears the add-item timeout after a successful online add', async () => {
    mockIsOffline = false;
    const list = shoppingListFactory.createWithItems({}, 1, 1);
    const categories = [shoppingListFactory.createCategory({ id: 'other' })];
    const addedItem = shoppingListFactory.createItem({
      id: 'added-item',
      shoppingListId: list.id,
      categoryId: 'other',
      name: 'Apples',
    });
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    jest.spyOn(shoppingListService, 'getShoppingListById').mockResolvedValue(list);
    jest.spyOn(shoppingListService, 'getCategories').mockResolvedValue(categories);
    jest.spyOn(shoppingListService, 'addItem').mockResolvedValue(addedItem);

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

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
