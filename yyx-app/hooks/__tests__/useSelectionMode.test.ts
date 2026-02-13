/**
 * useSelectionMode Tests
 *
 * Validates selection state and bulk selection helpers.
 */

import { renderHook, act } from '@/test/utils/render';
import { useSelectionMode } from '../useSelectionMode';
import { shoppingListFactory } from '@/test/factories';

describe('useSelectionMode', () => {
  it('selects all items', () => {
    const category = shoppingListFactory.createCategoryWithItems({}, 3);
    const { result } = renderHook(() =>
      useSelectionMode({ listId: 'list-1', categories: [category] })
    );

    act(() => {
      result.current.handleSelectAll();
    });

    expect(result.current.selectedItems.size).toBe(3);
  });

  it('clears selection when toggling select mode', () => {
    const category = shoppingListFactory.createCategoryWithItems({}, 2);
    const { result } = renderHook(() =>
      useSelectionMode({ listId: 'list-1', categories: [category] })
    );

    act(() => {
      result.current.handleSelectAll();
    });
    expect(result.current.selectedItems.size).toBe(2);

    act(() => {
      result.current.toggleSelectMode();
    });

    expect(result.current.selectedItems.size).toBe(0);
  });
});

