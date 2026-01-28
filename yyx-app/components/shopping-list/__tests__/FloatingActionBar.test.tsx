/**
 * FloatingActionBar Tests
 *
 * Validates select actions and conditional buttons.
 *
 * FOR AI AGENTS:
 * - Safe area insets are mocked for deterministic layout.
 */

import React from 'react';
import { render, screen, fireEvent } from '@/test/utils/render';
import { FloatingActionBar } from '../FloatingActionBar';
import i18n from '@/i18n';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('FloatingActionBar', () => {
  const baseProps = {
    selectedCount: 1,
    totalCount: 3,
    onCheckAll: jest.fn(),
    onUncheckAll: jest.fn(),
    onDeleteAll: jest.fn(),
    onCancel: jest.fn(),
    onSelectAll: jest.fn(),
    onDeselectAll: jest.fn(),
    hasCheckedItems: true,
    hasUncheckedItems: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls onSelectAll when not all items selected', () => {
    render(<FloatingActionBar {...baseProps} />);

    fireEvent.press(screen.getByText(i18n.t('shoppingList.selectAll')));

    expect(baseProps.onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('calls onDeselectAll when all items selected', () => {
    render(
      <FloatingActionBar
        {...baseProps}
        selectedCount={3}
        totalCount={3}
      />
    );

    fireEvent.press(screen.getByText(i18n.t('shoppingList.deselectAll')));

    expect(baseProps.onDeselectAll).toHaveBeenCalledTimes(1);
  });

  it('shows batch buttons based on checked/unchecked state', () => {
    render(
      <FloatingActionBar
        {...baseProps}
        hasCheckedItems={false}
        hasUncheckedItems={true}
      />
    );

    expect(screen.getByText(i18n.t('shoppingList.batchCheck'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('shoppingList.batchUncheck'))).toBeNull();
  });

  it('calls delete when delete action pressed', () => {
    render(<FloatingActionBar {...baseProps} />);

    fireEvent.press(screen.getByText(i18n.t('shoppingList.batchDelete')));

    expect(baseProps.onDeleteAll).toHaveBeenCalledTimes(1);
  });
});
