/**
 * CategorySection Tests
 *
 * Validates selection mode behavior and accessibility labels.
 */

import React from 'react';
import { fireEvent, render, screen } from '@/test/utils/render';
import { CategorySection } from '../CategorySection';
import { shoppingListFactory } from '@/test/factories';
import i18n from '@/i18n';

jest.mock('react-native-draggable-flatlist', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ data, renderItem }: any) => (
      <>
        {data.map((item: any, index: number) => (
          <React.Fragment key={item.id ?? index}>
            {renderItem({ item, index, drag: jest.fn(), isActive: false })}
          </React.Fragment>
        ))}
      </>
    ),
  };
});

describe('CategorySection', () => {
  it('shows selected count in select mode and uses i18n accessibility label', () => {
    const category = shoppingListFactory.createCategoryWithItems({}, 2);
    const selectedItems = new Set(category.items.map((item) => item.id));

    render(
      <CategorySection
        category={category}
        onCheckItem={jest.fn()}
        onDeleteItem={jest.fn()}
        onPressItem={jest.fn()}
        isSelectMode
        selectedItems={selectedItems}
      />
    );

    expect(screen.getByText('2/2')).toBeTruthy();
    expect(
      screen.getByLabelText(
        i18n.t('shoppingList.accessibility.categorySummary', {
          category: category.localizedName,
          checked: 0,
          total: 2,
        })
      )
    ).toBeTruthy();
  });

  it('toggles selection for all items in category when header pressed in select mode', () => {
    const category = shoppingListFactory.createCategoryWithItems({}, 3);
    const selectedItems = new Set<string>();
    const onSelectAllInCategory = jest.fn();

    render(
      <CategorySection
        category={category}
        onCheckItem={jest.fn()}
        onDeleteItem={jest.fn()}
        onPressItem={jest.fn()}
        isSelectMode
        selectedItems={selectedItems}
        onSelectAllInCategory={onSelectAllInCategory}
      />
    );

    fireEvent.press(
      screen.getByLabelText(
        i18n.t('shoppingList.accessibility.categorySummary', {
          category: category.localizedName,
          checked: 0,
          total: 3,
        })
      )
    );

    expect(onSelectAllInCategory).toHaveBeenCalledWith(
      category.id,
      category.items.map((item) => item.id)
    );
  });
});
