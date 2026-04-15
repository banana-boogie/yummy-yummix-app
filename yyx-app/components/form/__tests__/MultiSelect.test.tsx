/**
 * MultiSelect Tests
 *
 * Covers:
 * - Rendering trigger with placeholder
 * - Opening the modal and rendering options
 * - Toggling selection (checkmark and deselect)
 * - Confirm emits the pending selection via onValueChange
 * - Cancel reverts to the previously committed selection
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MultiSelect } from '../MultiSelect';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/components/common/Text', () => {
  const { Text } = require('react-native');
  return {
    Text: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
  };
});

jest.mock('@/components/common/Button', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    Button: ({ label, onPress }: any) => (
      <TouchableOpacity onPress={onPress}>
        <Text>{label}</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('@/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'common.cancel': 'Cancel',
      'common.done': 'Done',
      'common.noOptionsAvailable': 'No options available',
    };
    return translations[key] ?? key;
  },
}));

const OPTIONS = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
];

function openModal() {
  // The trigger shows the placeholder when nothing is selected.
  fireEvent.press(screen.getByText('Pick fruit'));
}

describe('MultiSelect', () => {
  it('renders trigger with placeholder when no values selected', () => {
    render(
      <MultiSelect
        options={OPTIONS}
        selectedValues={[]}
        onValueChange={jest.fn()}
        placeholder="Pick fruit"
      />
    );
    expect(screen.getByText('Pick fruit')).toBeTruthy();
  });

  it('renders selected labels joined on the trigger', () => {
    render(
      <MultiSelect
        options={OPTIONS}
        selectedValues={['apple', 'cherry']}
        onValueChange={jest.fn()}
        placeholder="Pick fruit"
      />
    );
    expect(screen.getByText('Apple, Cherry')).toBeTruthy();
  });

  it('opens the modal and lists options', () => {
    render(
      <MultiSelect
        options={OPTIONS}
        selectedValues={[]}
        onValueChange={jest.fn()}
        placeholder="Pick fruit"
      />
    );
    openModal();
    expect(screen.getByText('Apple')).toBeTruthy();
    expect(screen.getByText('Banana')).toBeTruthy();
    expect(screen.getByText('Cherry')).toBeTruthy();
  });

  it('uses title prop as header when provided', () => {
    render(
      <MultiSelect
        options={OPTIONS}
        selectedValues={[]}
        onValueChange={jest.fn()}
        placeholder="Pick fruit"
        title="Select your fruits"
      />
    );
    openModal();
    expect(screen.getByText('Select your fruits')).toBeTruthy();
  });

  it('confirm calls onValueChange with toggled selection', () => {
    const onValueChange = jest.fn();
    render(
      <MultiSelect
        options={OPTIONS}
        selectedValues={[]}
        onValueChange={onValueChange}
        placeholder="Pick fruit"
      />
    );
    openModal();
    fireEvent.press(screen.getByText('Apple'));
    fireEvent.press(screen.getByText('Cherry'));
    fireEvent.press(screen.getByText('Done'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(['apple', 'cherry']);
  });

  it('toggling an already-selected option removes it before confirm', () => {
    const onValueChange = jest.fn();
    render(
      <MultiSelect
        options={OPTIONS}
        selectedValues={['apple']}
        onValueChange={onValueChange}
        placeholder="Pick fruit"
      />
    );
    // Trigger shows "Apple" because it's selected — open via the trigger.
    fireEvent.press(screen.getByText('Apple'));
    // After opening, both trigger and option render "Apple"; the option is last.
    const appleMatches = screen.getAllByText('Apple');
    fireEvent.press(appleMatches[appleMatches.length - 1]); // deselect inside modal
    fireEvent.press(screen.getByText('Done'));
    expect(onValueChange).toHaveBeenCalledWith([]);
  });

  it('cancel does not call onValueChange and reverts pending changes', () => {
    const onValueChange = jest.fn();
    render(
      <MultiSelect
        options={OPTIONS}
        selectedValues={['apple']}
        onValueChange={onValueChange}
        placeholder="Pick fruit"
      />
    );
    fireEvent.press(screen.getByText('Apple')); // open
    fireEvent.press(screen.getByText('Banana')); // pending add
    fireEvent.press(screen.getByText('Cancel'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('renders empty state when no options provided', () => {
    render(
      <MultiSelect
        options={[]}
        selectedValues={[]}
        onValueChange={jest.fn()}
        placeholder="Pick fruit"
      />
    );
    openModal();
    expect(screen.getByText('No options available')).toBeTruthy();
  });
});
