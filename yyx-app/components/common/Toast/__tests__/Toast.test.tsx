import React from 'react';
import { renderWithProviders, screen, fireEvent, act } from '@/test/utils/render';
import { Toast, ToastConfig } from '../Toast';

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when toast is null', () => {
    const { toJSON } = renderWithProviders(
      <Toast toast={null} onDismiss={jest.fn()} />
    );

    expect(toJSON()).toBeNull();
  });

  it('renders the toast message', () => {
    const config: ToastConfig = { message: 'Cookbook created', type: 'success' };

    renderWithProviders(
      <Toast toast={config} onDismiss={jest.fn()} />
    );

    expect(screen.getByText('Cookbook created')).toBeTruthy();
  });

  it('calls onDismiss when pressed', () => {
    const onDismiss = jest.fn();
    const config: ToastConfig = { message: 'Test toast' };

    renderWithProviders(
      <Toast toast={config} onDismiss={onDismiss} />
    );

    fireEvent.press(screen.getByText('Test toast'));

    // Let animation complete
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(onDismiss).toHaveBeenCalled();
  });

  it('auto-dismisses after duration', () => {
    const onDismiss = jest.fn();
    const config: ToastConfig = { message: 'Auto dismiss', duration: 1000 };

    renderWithProviders(
      <Toast toast={config} onDismiss={onDismiss} />
    );

    act(() => {
      jest.advanceTimersByTime(1300);
    });

    expect(onDismiss).toHaveBeenCalled();
  });
});
