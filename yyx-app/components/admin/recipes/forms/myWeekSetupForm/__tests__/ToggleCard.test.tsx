import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ToggleCard } from '../ToggleCard';

describe('ToggleCard', () => {
  it('renders label and helper', () => {
    render(
      <ToggleCard
        label="Complete meal"
        helper="No sides needed"
        value={false}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Complete meal')).toBeTruthy();
    expect(screen.getByText('No sides needed')).toBeTruthy();
  });

  it('omits helper when not provided', () => {
    render(<ToggleCard label="Complete meal" value={false} onChange={() => {}} />);
    expect(screen.getByText('Complete meal')).toBeTruthy();
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
