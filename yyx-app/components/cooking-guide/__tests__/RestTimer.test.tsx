/**
 * RestTimer Component Tests
 *
 * Tests for the detectRestTime pure function and the RestTimer countdown component.
 */

import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { detectRestTime, RestTimer } from '../RestTimer';

// Mock @expo/vector-icons (not globally mocked in jest.setup)
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('detectRestTime', () => {
  // ============================================================
  // NULL CASES — no rest keyword or no time
  // ============================================================

  it('returns null when instruction has no rest keyword', () => {
    const result = detectRestTime('Chop the onions');

    expect(result).toBeNull();
  });

  it('returns null when rest keyword is present but no time value', () => {
    const result = detectRestTime('Let rest until firm');

    expect(result).toBeNull();
  });

  it('returns null for completely unrelated instruction', () => {
    const result = detectRestTime('Stir continuously over medium heat');

    expect(result).toBeNull();
  });

  // ============================================================
  // ENGLISH — minutes
  // ============================================================

  it('detects "let rest for 5 minutes" and returns 300 seconds', () => {
    const result = detectRestTime('Let rest for 5 minutes');

    expect(result).toBe(300);
  });

  it('detects "let sit for 10 minutes" and returns 600 seconds', () => {
    const result = detectRestTime('Let sit for 10 minutes');

    expect(result).toBe(600);
  });

  it('detects "set aside for 15 min" and returns 900 seconds', () => {
    const result = detectRestTime('Set aside for 15 min');

    expect(result).toBe(900);
  });

  // ============================================================
  // ENGLISH — hours
  // ============================================================

  it('detects "let cool for 2 hours" and returns 7200 seconds', () => {
    const result = detectRestTime('Let cool for 2 hours');

    expect(result).toBe(7200);
  });

  // ============================================================
  // ENGLISH — seconds
  // ============================================================

  it('detects "wait for 30 seconds" and returns 30', () => {
    const result = detectRestTime('Wait for 30 seconds');

    expect(result).toBe(30);
  });

  // ============================================================
  // SPANISH
  // ============================================================

  it('detects "dejar reposar por 30 minutos" and returns 1800 seconds', () => {
    const result = detectRestTime('Dejar reposar por 30 minutos');

    expect(result).toBe(1800);
  });

  it('detects "dejar enfriar por 15 minutos" and returns 900 seconds', () => {
    const result = detectRestTime('Dejar enfriar por 15 minutos');

    expect(result).toBe(900);
  });
});

describe('RestTimer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // RENDERING
  // ============================================================

  it('does not render when instruction has no rest keyword', () => {
    const { toJSON } = renderWithProviders(
      <RestTimer instruction="Chop the onions finely" />
    );

    expect(toJSON()).toBeNull();
  });

  it('renders timer with Start button when rest keyword is detected', () => {
    renderWithProviders(
      <RestTimer instruction="Let rest for 5 minutes before serving" />
    );

    expect(screen.getByText('Start')).toBeTruthy();
  });

  it('shows correct initial time display for 5 minutes', () => {
    renderWithProviders(
      <RestTimer instruction="Let rest for 5 minutes before serving" />
    );

    expect(screen.getByText('5:00')).toBeTruthy();
  });

  it('shows correct initial time display for 90 seconds (1:30)', () => {
    renderWithProviders(
      <RestTimer instruction="Let sit for 90 seconds" />
    );

    // 90 seconds does not match — the regex captures "90" with "seconds" pattern
    // 90 seconds = 1 min 30 sec
    expect(screen.getByText('1:30')).toBeTruthy();
  });

  it('shows correct initial time display for 2 hours', () => {
    renderWithProviders(
      <RestTimer instruction="Let cool for 2 hours in the fridge" />
    );

    // 7200 seconds = 120 minutes = "120:00"
    expect(screen.getByText('120:00')).toBeTruthy();
  });
});
