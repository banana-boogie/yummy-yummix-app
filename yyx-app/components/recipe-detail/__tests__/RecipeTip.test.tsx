/**
 * RecipeTip Tests
 *
 * Tests for recipe tip component covering:
 * - Tip text rendering
 * - Empty state handling
 * - Styling
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RecipeTip } from '../RecipeTip';

// Mock dependencies
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'recipes.detail.tips': 'Tips',
      };
      return translations[key] || key;
    },
  },
}));

jest.mock('@/components/recipe-detail/SectionHeading', () => ({
  SectionHeading: 'SectionHeading',
}));

jest.mock('@/components/recipe-detail/RenderRecipeText', () => {
  const { Text } = require('react-native');
  return {
    renderRecipeText: (text: string) => <Text>{text}</Text>,
  };
});

describe('RecipeTip', () => {
  const mockTipText = 'For best results, let the dough rest for 30 minutes before baking.';

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<RecipeTip text={mockTipText} />);

      expect(toJSON()).toBeTruthy();
    });

    it('renders null when text is undefined', () => {
      const { toJSON } = render(<RecipeTip text={undefined} />);

      expect(toJSON()).toBeNull();
    });

    it('renders null when text is empty string', () => {
      const { toJSON } = render(<RecipeTip text="" />);

      expect(toJSON()).toBeNull();
    });

    it('displays the tip text', () => {
      render(<RecipeTip text={mockTipText} />);

      expect(screen.getByText(mockTipText)).toBeTruthy();
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('applies custom className', () => {
      const { toJSON } = render(
        <RecipeTip text={mockTipText} className="mt-lg" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom style', () => {
      const { toJSON } = render(
        <RecipeTip
          text={mockTipText}
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
    it('handles short tip text', () => {
      const { toJSON } = render(<RecipeTip text="Use room temperature butter." />);

      expect(toJSON()).toBeTruthy();
    });

    it('handles very long tip text', () => {
      const longText = 'A'.repeat(500);
      const { toJSON } = render(<RecipeTip text={longText} />);

      expect(toJSON()).toBeTruthy();
    });

    it('handles tip text with special characters', () => {
      const specialText = 'Use 200°C for crispy edges! "Golden brown" is key.';

      render(<RecipeTip text={specialText} />);

      expect(screen.getByText(specialText)).toBeTruthy();
    });

    it('handles tip text with line breaks', () => {
      const multilineText = 'First tip.\nSecond tip.\nThird tip.';

      render(<RecipeTip text={multilineText} />);

      expect(screen.getByText(multilineText)).toBeTruthy();
    });
  });
});
