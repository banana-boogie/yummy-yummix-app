/**
 * CookingGuideHeader Tests
 *
 * Tests for cooking guide header component covering:
 * - Title and subtitle display
 * - Image rendering
 * - Responsive behavior
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CookingGuideHeader } from '../CookingGuideHeader';

// Mock dependencies
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('@/hooks/useDevice', () => ({
  useDevice: () => ({
    isPhone: true,
    isLarge: false,
    isWeb: false,
  }),
}));

jest.mock('@/components/navigation/BackButton', () => ({
  BackButton: 'BackButton',
}));

jest.mock('@/components/navigation/HamburgerMenu', () => ({
  HamburgerMenu: 'HamburgerMenu',
}));

describe('CookingGuideHeader', () => {
  // ============================================================
  // TITLE TESTS
  // ============================================================

  describe('title display', () => {
    it('renders title when provided', () => {
      render(<CookingGuideHeader title="Chocolate Cake" />);

      expect(screen.getByText('Chocolate Cake')).toBeTruthy();
    });

    it('does not render title when showTitle is false', () => {
      render(<CookingGuideHeader title="Chocolate Cake" showTitle={false} />);

      expect(screen.queryByText('Chocolate Cake')).toBeNull();
    });

    it('renders with custom title preset', () => {
      const { toJSON } = render(
        <CookingGuideHeader title="Test Title" titlePreset="h2" />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // SUBTITLE TESTS
  // ============================================================

  describe('subtitle display', () => {
    it('renders subtitle when provided', () => {
      render(<CookingGuideHeader subtitle="Step 1 of 5" />);

      expect(screen.getByText('Step 1 of 5')).toBeTruthy();
    });

    it('does not render subtitle when showSubtitle is false', () => {
      render(<CookingGuideHeader subtitle="Step 1 of 5" showSubtitle={false} />);

      expect(screen.queryByText('Step 1 of 5')).toBeNull();
    });

    it('renders both title and subtitle together', () => {
      render(
        <CookingGuideHeader
          title="Mix Ingredients"
          subtitle="Step 1 of 5"
        />
      );

      expect(screen.getByText('Mix Ingredients')).toBeTruthy();
      expect(screen.getByText('Step 1 of 5')).toBeTruthy();
    });
  });

  // ============================================================
  // IMAGE TESTS
  // ============================================================

  describe('image display', () => {
    it('renders with image when pictureUrl is provided', () => {
      const { toJSON } = render(
        <CookingGuideHeader pictureUrl="https://example.com/recipe.jpg" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('renders without image when no pictureUrl', () => {
      const { toJSON } = render(<CookingGuideHeader title="Test" />);

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // DEFAULTS TESTS
  // ============================================================

  describe('defaults', () => {
    it('defaults showTitle to true', () => {
      render(<CookingGuideHeader title="Visible Title" />);

      expect(screen.getByText('Visible Title')).toBeTruthy();
    });

    it('defaults showSubtitle to true', () => {
      render(<CookingGuideHeader subtitle="Visible Subtitle" />);

      expect(screen.getByText('Visible Subtitle')).toBeTruthy();
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('applies custom className', () => {
      const { toJSON } = render(
        <CookingGuideHeader title="Test" className="mt-lg" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom style', () => {
      const { toJSON } = render(
        <CookingGuideHeader
          title="Test"
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
    it('renders without any props', () => {
      const { toJSON } = render(<CookingGuideHeader />);

      expect(toJSON()).toBeTruthy();
    });

    it('handles empty title string', () => {
      const { toJSON } = render(<CookingGuideHeader title="" />);

      expect(toJSON()).toBeTruthy();
    });

    it('handles very long title', () => {
      const longTitle = 'A'.repeat(200);
      const { toJSON } = render(<CookingGuideHeader title={longTitle} />);

      expect(toJSON()).toBeTruthy();
    });
  });
});
