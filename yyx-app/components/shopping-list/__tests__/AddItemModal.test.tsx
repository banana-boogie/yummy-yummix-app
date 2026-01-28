/**
 * AddItemModal Tests
 *
 * Validates search debounce and add item behavior.
 */

import React from 'react';
import { fireEvent, render, screen, act } from '@/test/utils/render';
import { AddItemModal } from '../AddItemModal';
import { shoppingListFactory } from '@/test/factories';
import { shoppingListService } from '@/services/shoppingListService';
import i18n from '@/i18n';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('AddItemModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces ingredient search and renders suggestions', async () => {
    const categories = [shoppingListFactory.createCategory({ id: 'other' })];
    const suggestion = shoppingListFactory.createIngredientSuggestion({
      id: 'ing-1',
      name: 'Milk',
      pluralName: 'Milks',
      categoryId: 'other',
    });
    const searchSpy = jest
      .spyOn(shoppingListService, 'searchIngredients')
      .mockResolvedValue([suggestion]);

    render(
      <AddItemModal
        visible
        onClose={jest.fn()}
        onAddItem={jest.fn()}
        categories={categories}
      />
    );

    fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('shoppingList.searchItems')),
      'Mi'
    );

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(searchSpy).toHaveBeenCalledWith('Mi');
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('adds item with custom name when no ingredient selected', () => {
    const categories = [shoppingListFactory.createCategory({ id: 'other' })];
    const onAddItem = jest.fn();

    render(
      <AddItemModal
        visible
        onClose={jest.fn()}
        onAddItem={onAddItem}
        categories={categories}
      />
    );

    fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('shoppingList.searchItems')),
      'Apples'
    );

    fireEvent.press(screen.getByText(i18n.t('common.done')));

    expect(onAddItem).toHaveBeenCalledWith({
      ingredientId: undefined,
      nameCustom: 'Apples',
      categoryId: 'other',
      quantity: 1,
      notes: undefined,
    });
  });
});
