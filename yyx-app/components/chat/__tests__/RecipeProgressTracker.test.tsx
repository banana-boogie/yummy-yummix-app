import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { RecipeProgressTracker, PROGRESS_CONFIG } from '../RecipeProgressTracker';

// Mock i18n
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'chat.progressTracker.stage1': 'Understanding your craving...',
        'chat.progressTracker.stage2': 'Selecting the best ingredients...',
        'chat.progressTracker.stage3': 'Planning cooking times...',
        'chat.progressTracker.stage4': 'Writing out the steps...',
        'chat.progressTracker.stage5': 'Final touches...',
        'chat.progressTracker.stage6': 'Ready!',
        'chat.progressTracker.stall': 'Almost there...',
      };
      return translations[key] || key;
    },
  },
}));

// Mock Animated to avoid timer issues in tests
jest.useFakeTimers();

describe('RecipeProgressTracker', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  it('renders nothing when not active', () => {
    const { toJSON } = render(
      <RecipeProgressTracker isActive={false} hasRecipe={false} />
    );
    expect(toJSON()).toBeNull();
  });

  it('renders when active', () => {
    render(<RecipeProgressTracker isActive={true} hasRecipe={false} />);
    expect(screen.getByText('Understanding your craving...')).toBeTruthy();
  });

  it('shows first stage label initially', () => {
    render(<RecipeProgressTracker isActive={true} hasRecipe={false} />);
    expect(screen.getByText('Understanding your craving...')).toBeTruthy();
  });

  it('advances stages on timer', () => {
    render(<RecipeProgressTracker isActive={true} hasRecipe={false} />);

    // Advance past stage 1 duration (2000ms)
    act(() => {
      jest.advanceTimersByTime(2100);
    });

    expect(screen.getByText('Selecting the best ingredients...')).toBeTruthy();
  });

  it('advances to stage 3 after sufficient time', () => {
    render(<RecipeProgressTracker isActive={true} hasRecipe={false} />);

    // Advance past stage 1 (2000ms) + stage 2 (10000ms)
    act(() => {
      jest.advanceTimersByTime(12100);
    });

    expect(screen.getByText('Planning cooking times...')).toBeTruthy();
  });

  it('snaps to stage 2 on SSE generating status', () => {
    const { rerender } = render(
      <RecipeProgressTracker
        isActive={true}
        hasRecipe={false}
        currentStatus="thinking"
      />
    );

    // Should start at stage 1
    expect(screen.getByText('Understanding your craving...')).toBeTruthy();

    // SSE generating status should snap to stage 2 (index 1)
    rerender(
      <RecipeProgressTracker
        isActive={true}
        hasRecipe={false}
        currentStatus="generating"
      />
    );

    expect(screen.getByText('Selecting the best ingredients...')).toBeTruthy();
  });

  it('snaps to stage 5 on SSE enriching status', () => {
    const { rerender } = render(
      <RecipeProgressTracker
        isActive={true}
        hasRecipe={false}
        currentStatus="generating"
      />
    );

    // SSE enriching status should snap to stage 5 (index 4)
    rerender(
      <RecipeProgressTracker
        isActive={true}
        hasRecipe={false}
        currentStatus="enriching"
      />
    );

    expect(screen.getByText('Final touches...')).toBeTruthy();
  });

  it('shows Ready on hasRecipe', () => {
    const { rerender } = render(
      <RecipeProgressTracker isActive={true} hasRecipe={false} />
    );

    rerender(
      <RecipeProgressTracker isActive={true} hasRecipe={true} />
    );

    expect(screen.getByText('Ready!')).toBeTruthy();
  });

  it('never goes backwards (monotonic progression)', () => {
    const { rerender } = render(
      <RecipeProgressTracker
        isActive={true}
        hasRecipe={false}
        currentStatus="generating"
      />
    );

    // Advance to enriching (stage 5)
    rerender(
      <RecipeProgressTracker
        isActive={true}
        hasRecipe={false}
        currentStatus="enriching"
      />
    );

    expect(screen.getByText('Final touches...')).toBeTruthy();

    // Go back to generating — should NOT go backwards
    rerender(
      <RecipeProgressTracker
        isActive={true}
        hasRecipe={false}
        currentStatus="generating"
      />
    );

    // Should still show Final touches (stage 5), not stage 2
    expect(screen.getByText('Final touches...')).toBeTruthy();
  });

  it('skip-forward works when enriching arrives early', () => {
    const { rerender } = render(
      <RecipeProgressTracker
        isActive={true}
        hasRecipe={false}
        currentStatus="thinking"
      />
    );

    // Should be at stage 1
    expect(screen.getByText('Understanding your craving...')).toBeTruthy();

    // Timer hasn't advanced but enriching arrives — should jump to stage 5
    rerender(
      <RecipeProgressTracker
        isActive={true}
        hasRecipe={false}
        currentStatus="enriching"
      />
    );

    expect(screen.getByText('Final touches...')).toBeTruthy();
  });

  it('timer-only mode advances through stages without SSE', () => {
    render(
      <RecipeProgressTracker isActive={true} hasRecipe={false} />
    );

    // No currentStatus — pure timer mode
    // Advance through stage 1 (2s) + stage 2 (10s) + stage 3 (10s) + stage 4 (13s)
    act(() => {
      jest.advanceTimersByTime(35100);
    });

    expect(screen.getByText('Final touches...')).toBeTruthy();
  });

  it('shows stall message after extended wait', () => {
    render(
      <RecipeProgressTracker isActive={true} hasRecipe={false} />
    );

    // Advance past stall threshold
    act(() => {
      jest.advanceTimersByTime(PROGRESS_CONFIG.stallThresholdMs + 100);
    });

    expect(screen.getByText('Almost there...')).toBeTruthy();
  });

  it('does not auto-advance to ready stage on timer alone', () => {
    render(
      <RecipeProgressTracker isActive={true} hasRecipe={false} />
    );

    // Advance well past all stage durations
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    // Should be at stage 5 (final touches), NOT stage 6 (ready)
    // Ready only triggers via hasRecipe
    expect(screen.getByText('Final touches...')).toBeTruthy();
    expect(screen.queryByText('Ready!')).toBeNull();
  });

  it('has correct PROGRESS_CONFIG structure', () => {
    expect(PROGRESS_CONFIG.stages).toHaveLength(6);
    expect(PROGRESS_CONFIG.stages[0].key).toBe('understanding');
    expect(PROGRESS_CONFIG.stages[5].key).toBe('ready');
    expect(PROGRESS_CONFIG.stages[5].durationMs).toBe(0);
    expect(PROGRESS_CONFIG.sseAnchors.generating).toBe(1);
    expect(PROGRESS_CONFIG.sseAnchors.enriching).toBe(4);
  });
});
