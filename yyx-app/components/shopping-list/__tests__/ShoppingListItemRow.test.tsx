/**
 * ShoppingListItemRow Tests
 *
 * Validates item rendering, quantity controls, and selection behavior.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@/test/utils/render';
import { ShoppingListItemRow } from '../ShoppingListItem';
import { shoppingListFactory, createMeasurementUnit } from '@/test/factories';
import i18n from '@/i18n';

const unit = createMeasurementUnit({
  type: 'weight',
  system: 'imperial',
  name: 'pound',
  symbol: 'lb',
  symbolPlural: 'lbs',
});

describe('ShoppingListItemRow', () => {
  it('renders item name and formatted quantity', () => {
    const item = shoppingListFactory.createItem({
      name: 'Flour',
      quantity: 2,
      unit,
      isChecked: false,
    });

    render(
      <ShoppingListItemRow
        item={item}
        onCheck={jest.fn()}
        onPress={jest.fn()}
      />
    );

    expect(screen.getByText('Flour')).toBeTruthy();
    expect(screen.getByText('2 lb')).toBeTruthy();
  });

  it('calls onCheck when checkbox pressed', async () => {
    const item = shoppingListFactory.createItem({ name: 'Eggs' });
    const onCheck = jest.fn();

    render(
      <ShoppingListItemRow
        item={item}
        onCheck={onCheck}
        onPress={jest.fn()}
        isSelectMode
      />
    );

    await act(async () => {
      fireEvent.press(
        screen.getByLabelText(
          i18n.t('shoppingList.accessibility.toggleItem', { name: 'Eggs' })
        )
      );
    });

    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('calls onMore when the per-row action icon is pressed', async () => {
    const item = shoppingListFactory.createItem({ name: 'Bread' });
    const onMore = jest.fn();

    render(
      <ShoppingListItemRow
        item={item}
        onCheck={jest.fn()}
        onPress={jest.fn()}
        onMore={onMore}
      />
    );

    await act(async () => {
      fireEvent.press(
        screen.getByLabelText(
          i18n.t('shoppingList.accessibility.itemActions', { name: 'Bread' })
        )
      );
    });

    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it('calls onQuantityChange when plus and minus pressed', async () => {
    const item = shoppingListFactory.createItem({ name: 'Milk', quantity: 2 });
    const onQuantityChange = jest.fn();

    render(
      <ShoppingListItemRow
        item={item}
        onCheck={jest.fn()}
        onPress={jest.fn()}
        onQuantityChange={onQuantityChange}
      />
    );

    await act(async () => {
      fireEvent.press(
        screen.getByLabelText(
          i18n.t('shoppingList.accessibility.increaseQuantity', { name: 'Milk' })
        )
      );
    });

    await act(async () => {
      fireEvent.press(
        screen.getByLabelText(
          i18n.t('shoppingList.accessibility.decreaseQuantity', { name: 'Milk' })
        )
      );
    });

    expect(onQuantityChange).toHaveBeenCalledWith(3);
    expect(onQuantityChange).toHaveBeenCalledWith(1);
  });
});
