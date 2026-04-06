/**
 * KitchenTimer Component Tests
 *
 * Tests for the KitchenTimer countdown component.
 */

import React from 'react';
import { renderWithProviders, screen, fireEvent, act } from '@/test/utils/render';
import { KitchenTimer } from '../KitchenTimer';

import notificationService from '@/services/notifications/NotificationService';

// Mock @expo/vector-icons (not globally mocked in jest.setup)
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/services/notifications/NotificationService', () => ({
  __esModule: true,
  default: {
    fireTimerNotification: jest.fn().mockResolvedValue(undefined),
    scheduleTimerNotification: jest.fn().mockResolvedValue('notif-123'),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockSchedule = notificationService.scheduleTimerNotification as jest.Mock;
const mockCancel = notificationService.cancelNotification as jest.Mock;
const mockFire = notificationService.fireTimerNotification as jest.Mock;

describe('KitchenTimer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================================
  // RENDERING
  // ============================================================

  it('does not render when durationSeconds is not provided', () => {
    const { toJSON } = renderWithProviders(
      <KitchenTimer />
    );

    expect(toJSON()).toBeNull();
  });

  it('does not render when durationSeconds is null', () => {
    const { toJSON } = renderWithProviders(
      <KitchenTimer durationSeconds={null} />
    );

    expect(toJSON()).toBeNull();
  });

  it('renders timer with Start button when durationSeconds is provided', () => {
    renderWithProviders(
      <KitchenTimer durationSeconds={300} />
    );

    expect(screen.getByText('Start')).toBeTruthy();
  });

  it('shows the Kitchen Timer label', () => {
    renderWithProviders(
      <KitchenTimer durationSeconds={300} />
    );

    expect(screen.getByText('Kitchen Timer')).toBeTruthy();
  });

  it('shows correct initial time display for 5 minutes (300s)', () => {
    renderWithProviders(
      <KitchenTimer durationSeconds={300} />
    );

    expect(screen.getByText('5:00')).toBeTruthy();
  });

  it('shows correct initial time display for 90 seconds (1:30)', () => {
    renderWithProviders(
      <KitchenTimer durationSeconds={90} />
    );

    expect(screen.getByText('1:30')).toBeTruthy();
  });

  it('shows correct initial time display for 2 hours (7200s)', () => {
    renderWithProviders(
      <KitchenTimer durationSeconds={7200} />
    );

    expect(screen.getByText('120:00')).toBeTruthy();
  });

  // ============================================================
  // NOTIFICATION LIFECYCLE
  // ============================================================

  it('schedules a background notification when timer starts', async () => {
    renderWithProviders(
      <KitchenTimer durationSeconds={300} />
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Start'));
    });

    expect(mockSchedule).toHaveBeenCalledWith(
      expect.any(String),
      300,
    );
  });

  it('cancels the scheduled notification when timer is paused', async () => {
    renderWithProviders(
      <KitchenTimer durationSeconds={300} />
    );

    // Start
    await act(async () => {
      fireEvent.press(screen.getByText('Start'));
    });

    mockCancel.mockClear();

    // Pause
    await act(async () => {
      fireEvent.press(screen.getByText('Pause'));
    });

    expect(mockCancel).toHaveBeenCalledWith('notif-123');
  });

  it('does not cancel notification on reset after completion (already cleared)', async () => {
    renderWithProviders(
      <KitchenTimer durationSeconds={2} />
    );

    // Start
    await act(async () => {
      fireEvent.press(screen.getByText('Start'));
    });

    // Tick to completion
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    mockCancel.mockClear();

    // Reset
    await act(async () => {
      fireEvent.press(screen.getByText('Reset'));
    });

    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('cancels the scheduled notification on unmount', async () => {
    const { unmount } = renderWithProviders(
      <KitchenTimer durationSeconds={300} />
    );

    // Start the timer
    await act(async () => {
      fireEvent.press(screen.getByText('Start'));
    });

    mockCancel.mockClear();

    // Unmount
    unmount();

    expect(mockCancel).toHaveBeenCalledWith('notif-123');
  });

  it('fires immediate notification on foreground completion', async () => {
    renderWithProviders(
      <KitchenTimer durationSeconds={1} />
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Start'));
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockFire).toHaveBeenCalledWith(expect.any(String));
  });
});
