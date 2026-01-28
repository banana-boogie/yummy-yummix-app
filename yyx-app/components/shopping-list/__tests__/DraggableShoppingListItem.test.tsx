/**
 * DraggableShoppingListItem Tests
 *
 * Validates drag handle behavior and selection mode rendering.
 *
 * FOR AI AGENTS:
 * - Mocks ShoppingListItemRow to isolate drag handle logic
 */

import React from 'react';
import { render, screen, fireEvent } from '@/test/utils/render';
import { DraggableShoppingListItem } from '../DraggableShoppingListItem';
import { shoppingListFactory } from '@/test/factories';
import i18n from '@/i18n';

const mockRow = jest.fn();

jest.mock('../ShoppingListItem', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    ShoppingListItemRow: (props: any) => {
      mockRow(props);
      return <Text>{props.item.name}</Text>;
    },
  };
});

describe('DraggableShoppingListItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders drag handle and calls drag on press in', () => {
    const item = shoppingListFactory.createItem({ name: 'Milk' });
    const drag = jest.fn();

    render(
      <DraggableShoppingListItem
        item={item}
        drag={drag}
        isActive={false}
        onCheck={jest.fn()}
        onDelete={jest.fn()}
        onPress={jest.fn()}
      />
    );

    fireEvent(
      screen.getByLabelText(i18n.t('shoppingList.dragToReorder')),
      'pressIn'
    );

    expect(drag).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('hides drag handle in select mode', () => {
    const item = shoppingListFactory.createItem({ name: 'Bread' });

    render(
      <DraggableShoppingListItem
        item={item}
        drag={jest.fn()}
        isActive={false}
        onCheck={jest.fn()}
        onDelete={jest.fn()}
        onPress={jest.fn()}
        isSelectMode
      />
    );

    expect(screen.queryByLabelText(i18n.t('shoppingList.dragToReorder'))).toBeNull();
  });
});
