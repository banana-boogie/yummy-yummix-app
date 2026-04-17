import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { InfoTooltip } from '../InfoTooltip';

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const map: Record<string, string> = {
        'common.moreInfo': 'More information',
      };
      return map[key] ?? key;
    },
  },
}));

describe('InfoTooltip', () => {
  it('renders the icon button with accessibility label', () => {
    render(<InfoTooltip content="Helpful explanation" />);
    expect(screen.getByLabelText('More information')).toBeTruthy();
  });

  it('uses override accessibilityLabel when provided', () => {
    render(
      <InfoTooltip content="Helpful" accessibilityLabel="Why this matters" />,
    );
    expect(screen.getByLabelText('Why this matters')).toBeTruthy();
  });

  it('hides the panel by default', () => {
    render(<InfoTooltip content="Helpful explanation" />);
    expect(screen.queryByText('Helpful explanation')).toBeNull();
  });

  it('shows the panel after tapping the icon', () => {
    render(<InfoTooltip content="Helpful explanation" />);
    fireEvent.press(screen.getByLabelText('More information'));
    expect(screen.getByText('Helpful explanation')).toBeTruthy();
  });

  it('hides the panel when tapping the icon a second time', () => {
    render(<InfoTooltip content="Helpful explanation" />);
    const button = screen.getByLabelText('More information');
    fireEvent.press(button);
    expect(screen.getByText('Helpful explanation')).toBeTruthy();
    fireEvent.press(button);
    expect(screen.queryByText('Helpful explanation')).toBeNull();
  });
});
