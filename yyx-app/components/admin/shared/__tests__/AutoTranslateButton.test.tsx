import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { AutoTranslateButton } from '../AutoTranslateButton';

describe('AutoTranslateButton', () => {
  const defaultProps = {
    onPress: jest.fn(),
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the auto-translate label when not loading', () => {
    renderWithProviders(<AutoTranslateButton {...defaultProps} />);
    expect(screen.getByText(/auto/i)).toBeTruthy();
  });

  it('renders the translating label when loading', () => {
    renderWithProviders(<AutoTranslateButton {...defaultProps} loading={true} />);
    expect(screen.getByText(/translat/i)).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    renderWithProviders(<AutoTranslateButton {...defaultProps} onPress={onPress} />);
    fireEvent.press(screen.getByText(/auto/i));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not render error text when error is null', () => {
    renderWithProviders(<AutoTranslateButton {...defaultProps} error={null} />);
    expect(screen.queryByText(/failed/i)).toBeNull();
  });

  it('renders error text when error is provided', () => {
    renderWithProviders(
      <AutoTranslateButton {...defaultProps} error="Translation failed for: en" />
    );
    expect(screen.getByText('Translation failed for: en')).toBeTruthy();
  });
});
