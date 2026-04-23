import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ToggleCard } from '../ToggleCard';

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

describe('ToggleCard', () => {
  it('renders label and exposes helper via info tooltip', () => {
    render(
      <ToggleCard
        label="Complete meal"
        helper="No sides needed"
        value={false}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Complete meal')).toBeTruthy();
    // Helper is hidden behind the tooltip — not visible until tapped.
    expect(screen.queryByText('No sides needed')).toBeNull();
    const tooltip = screen.getByLabelText('More information');
    fireEvent.press(tooltip);
    expect(screen.getByText('No sides needed')).toBeTruthy();
  });

  it('omits tooltip when helper not provided', () => {
    render(<ToggleCard label="Complete meal" value={false} onChange={() => {}} />);
    expect(screen.getByText('Complete meal')).toBeTruthy();
    expect(screen.queryByLabelText('More information')).toBeNull();
  });

  it('flips value when card pressed', () => {
    const onChange = jest.fn();
    render(<ToggleCard label="Complete meal" value={false} onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('Complete meal'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('flips value to false when card pressed while on', () => {
    const onChange = jest.fn();
    render(<ToggleCard label="Complete meal" value={true} onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('Complete meal'));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
