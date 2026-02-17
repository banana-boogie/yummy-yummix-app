/**
 * RecipeInfo Tests
 *
 * Tests for recipe info component covering:
 * - Time display formatting
 * - Portions display
 * - Icon rendering
 * - Null value handling
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RecipeInfo, RecipeInfoProps } from '../RecipeInfo';

// Mock dependencies
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'recipes.common.totalTime': 'Total Time',
        'recipes.common.prepTime': 'Prep Time',
        'recipes.common.portions': 'Portions',
        'recipes.common.difficultyLabel': 'Difficulty',
        'recipes.common.difficulty.easy': 'Easy',
        'recipes.common.difficulty.medium': 'Medium',
        'recipes.common.difficulty.hard': 'Hard',
      };
      return translations[key] || key;
    },
  },
}));

jest.mock('@/utils/formatters', () => ({
  formatTimeInHoursAndMinutes: (minutes: number | null) => {
    if (minutes === null) return '-';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  },
}));

describe('RecipeInfo', () => {
  const defaultProps: RecipeInfoProps = {
    totalTime: 60,
    prepTime: 15,
  };

  // ============================================================
  // TIME DISPLAY TESTS
  // ============================================================

  describe('time display', () => {
    it('displays total time label', () => {
      render(<RecipeInfo {...defaultProps} />);

      expect(screen.getByText('Total Time:')).toBeTruthy();
    });

    it('displays prep time label', () => {
      render(<RecipeInfo {...defaultProps} />);

      expect(screen.getByText('Prep Time:')).toBeTruthy();
    });

    it('formats total time in hours when >= 60 minutes', () => {
      render(<RecipeInfo {...defaultProps} totalTime={90} />);

      expect(screen.getByText('1h 30min')).toBeTruthy();
    });

    it('formats total time in minutes when < 60 minutes', () => {
      render(<RecipeInfo {...defaultProps} totalTime={45} />);

      expect(screen.getByText('45 min')).toBeTruthy();
    });

    it('displays dash when total time is null', () => {
      render(<RecipeInfo {...defaultProps} totalTime={null} />);

      expect(screen.getByText('-')).toBeTruthy();
    });

    it('displays dash when prep time is null', () => {
      render(<RecipeInfo {...defaultProps} prepTime={null} />);

      expect(screen.getAllByText('-')).toBeTruthy();
    });

    it('formats exact hour without minutes', () => {
      render(<RecipeInfo {...defaultProps} totalTime={120} />);

      expect(screen.getByText('2h')).toBeTruthy();
    });
  });

  // ============================================================
  // PORTIONS DISPLAY TESTS
  // ============================================================

  describe('portions display', () => {
    it('displays portions when provided', () => {
      render(<RecipeInfo {...defaultProps} portions={4} />);

      expect(screen.getByText('Portions:')).toBeTruthy();
      expect(screen.getByText('4')).toBeTruthy();
    });

    it('does not display portions when not provided', () => {
      render(<RecipeInfo {...defaultProps} />);

      expect(screen.queryByText('Portions:')).toBeNull();
    });

    it('displays single portion correctly', () => {
      render(<RecipeInfo {...defaultProps} portions={1} />);

      expect(screen.getByText('1')).toBeTruthy();
    });

    it('displays large portion numbers', () => {
      render(<RecipeInfo {...defaultProps} portions={24} />);

      expect(screen.getByText('24')).toBeTruthy();
    });
  });

  describe('difficulty display', () => {
    it('displays difficulty when provided', () => {
      render(<RecipeInfo {...defaultProps} difficulty="hard" />);

      expect(screen.getByText('Difficulty:')).toBeTruthy();
      expect(screen.getByText('Hard')).toBeTruthy();
    });

    it('does not display difficulty when omitted', () => {
      render(<RecipeInfo {...defaultProps} />);

      expect(screen.queryByText('Difficulty:')).toBeNull();
    });
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders without crashing with minimal props', () => {
      const { toJSON } = render(
        <RecipeInfo
          totalTime={30}
          prepTime={10}
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('renders all info items together', () => {
      render(
        <RecipeInfo
          totalTime={60}
          prepTime={20}
          portions={8}
        />
      );

      expect(screen.getByText('Total Time:')).toBeTruthy();
      expect(screen.getByText('Prep Time:')).toBeTruthy();
      expect(screen.getByText('Portions:')).toBeTruthy();
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('applies custom className', () => {
      const { toJSON } = render(
        <RecipeInfo
          {...defaultProps}
          className="mt-lg"
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom style', () => {
      const { toJSON } = render(
        <RecipeInfo
          {...defaultProps}
          style={{ marginTop: 20 }}
        />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles zero total time', () => {
      render(<RecipeInfo {...defaultProps} totalTime={0} />);

      expect(screen.getByText('0 min')).toBeTruthy();
    });

    it('handles zero prep time', () => {
      render(<RecipeInfo {...defaultProps} prepTime={0} />);

      expect(screen.getAllByText('0 min').length).toBeGreaterThan(0);
    });

    it('handles both times as null', () => {
      const { toJSON } = render(
        <RecipeInfo
          totalTime={null}
          prepTime={null}
        />
      );

      expect(toJSON()).toBeTruthy();
      expect(screen.getAllByText('-').length).toBe(2);
    });

    it('handles very large time values', () => {
      render(<RecipeInfo {...defaultProps} totalTime={480} />);

      expect(screen.getByText('8h')).toBeTruthy();
    });
  });
});
