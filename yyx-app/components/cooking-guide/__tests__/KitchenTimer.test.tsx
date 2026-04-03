/**
 * KitchenTimer Component Tests
 *
 * Tests for the detectLegacyStepTimer pure function and the KitchenTimer countdown component.
 */

import React from 'react';
import { renderWithProviders, screen, fireEvent, act } from '@/test/utils/render';
import { detectLegacyStepTimer, KitchenTimer } from '../KitchenTimer';

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

describe('detectLegacyStepTimer', () => {
  // ============================================================
  // NULL CASES — no rest keyword or no time
  // ============================================================

  it('returns null when instruction has no rest keyword', () => {
    const result = detectLegacyStepTimer('Chop the onions');

    expect(result).toBeNull();
  });

  it('returns null when rest keyword is present but no time value', () => {
    const result = detectLegacyStepTimer('Let rest until firm');

    expect(result).toBeNull();
  });

  it('returns null for completely unrelated instruction', () => {
    const result = detectLegacyStepTimer('Stir continuously over medium heat');

    expect(result).toBeNull();
  });

  // ============================================================
  // ENGLISH — minutes
  // ============================================================

  it('detects "let rest for 5 minutes" and returns 300 seconds', () => {
    const result = detectLegacyStepTimer('Let rest for 5 minutes');

    expect(result).toBe(300);
  });

  it('detects "let sit for 10 minutes" and returns 600 seconds', () => {
    const result = detectLegacyStepTimer('Let sit for 10 minutes');

    expect(result).toBe(600);
  });

  it('detects "set aside for 15 min" and returns 900 seconds', () => {
    const result = detectLegacyStepTimer('Set aside for 15 min');

    expect(result).toBe(900);
  });

  // ============================================================
  // ENGLISH — hours
  // ============================================================

  it('detects "let cool for 2 hours" and returns 7200 seconds', () => {
    const result = detectLegacyStepTimer('Let cool for 2 hours');

    expect(result).toBe(7200);
  });

  // ============================================================
  // ENGLISH — seconds
  // ============================================================

  it('detects "wait for 30 seconds" and returns 30', () => {
    const result = detectLegacyStepTimer('Wait for 30 seconds');

    expect(result).toBe(30);
  });

  // ============================================================
  // SPANISH
  // ============================================================

  it('detects "dejar reposar por 30 minutos" and returns 1800 seconds', () => {
    const result = detectLegacyStepTimer('Dejar reposar por 30 minutos');

    expect(result).toBe(1800);
  });

  it('detects "dejar enfriar por 15 minutos" and returns 900 seconds', () => {
    const result = detectLegacyStepTimer('Dejar enfriar por 15 minutos');

    expect(result).toBe(900);
  });
});

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

  it('does not render when instruction has no rest keyword', () => {
    const { toJSON } = renderWithProviders(
      <KitchenTimer instruction="Chop the onions finely" />
    );

    expect(toJSON()).toBeNull();
  });

  it('renders timer with Start button when rest keyword is detected', () => {
    renderWithProviders(
      <KitchenTimer instruction="Let rest for 5 minutes before serving" />
    );

    expect(screen.getByText('Start')).toBeTruthy();
  });

  it('shows the Kitchen Timer label', () => {
    renderWithProviders(
      <KitchenTimer instruction="Let rest for 5 minutes before serving" />
    );

    expect(screen.getByText('Kitchen Timer')).toBeTruthy();
  });

  it('shows correct initial time display for 5 minutes', () => {
    renderWithProviders(
      <KitchenTimer instruction="Let rest for 5 minutes before serving" />
    );

    expect(screen.getByText('5:00')).toBeTruthy();
  });

  it('shows correct initial time display for 90 seconds (1:30)', () => {
    renderWithProviders(
      <KitchenTimer instruction="Let sit for 90 seconds" />
    );

    // 90 seconds does not match — the regex captures "90" with "seconds" pattern
    // 90 seconds = 1 min 30 sec
    expect(screen.getByText('1:30')).toBeTruthy();
  });

  it('shows correct initial time display for 2 hours', () => {
    renderWithProviders(
      <KitchenTimer instruction="Let cool for 2 hours in the fridge" />
    );

    // 7200 seconds = 120 minutes = "120:00"
    expect(screen.getByText('120:00')).toBeTruthy();
  });

  // ============================================================
  // NOTIFICATION LIFECYCLE
  // ============================================================

  it('schedules a background notification when timer starts', async () => {
    renderWithProviders(
      <KitchenTimer instruction="Let rest for 5 minutes" />
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Start'));
    });

    expect(mockSchedule).toHaveBeenCalledWith(
      expect.any(String),
      300, // 5 minutes in seconds
    );
  });

  it('cancels the scheduled notification when timer is paused', async () => {
    renderWithProviders(
      <KitchenTimer instruction="Let rest for 5 minutes" />
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
      <KitchenTimer durationSeconds={2} instruction="Let rest for 2 seconds" />
    );

    // Start
    await act(async () => {
      fireEvent.press(screen.getByText('Start'));
    });

    // Tick to completion — notification ref is cleared on completion
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    mockCancel.mockClear();

    // Reset — no cancel needed since the ref was already null
    await act(async () => {
      fireEvent.press(screen.getByText('Reset'));
    });

    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('cancels the scheduled notification on unmount', async () => {
    const { unmount } = renderWithProviders(
      <KitchenTimer instruction="Let rest for 5 minutes" />
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
      <KitchenTimer durationSeconds={1} instruction="Let rest for 1 second" />
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
