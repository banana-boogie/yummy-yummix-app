/**
 * ShoppingListCard Tests
 *
 * Validates rendering and accessibility of the list summary card.
 */

import React from 'react';
import { render, screen } from '@/test/utils/render';
import { ShoppingListCard } from '../ShoppingListCard';
import { shoppingListFactory } from '@/test/factories';
import i18n from '@/i18n';

describe('ShoppingListCard', () => {
  it('renders list name and checked counts', () => {
    const list = shoppingListFactory.create({
      name: 'Weekend Groceries',
      itemCount: 5,
      checkedCount: 2,
    });

    render(<ShoppingListCard list={list} />);

    expect(screen.getByText('Weekend Groceries')).toBeTruthy();
    expect(
      screen.getByText(
        i18n.t('shoppingList.checkedOff', { checked: 2, total: 5 })
      )
    ).toBeTruthy();
  });

  it('uses i18n accessibility label with counts', () => {
    const list = shoppingListFactory.create({
      name: 'Weekly',
      itemCount: 3,
      checkedCount: 1,
    });

    render(<ShoppingListCard list={list} />);

    expect(
      screen.getByLabelText(
        i18n.t('shoppingList.accessibility.listSummary', {
          name: 'Weekly',
          checked: 1,
          total: 3,
        })
      )
    ).toBeTruthy();
  });
});

