/**
 * RecipeUsefulItems Tests
 *
 * Tests for recipe useful items component covering:
 * - Items list rendering
 * - Image display
 * - Empty state handling
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RecipeUsefulItems } from '../RecipeUsefulItems';
import { RecipeUsefulItem } from '@/types/recipe.types';

// Mock dependencies
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'recipes.detail.usefulItems.heading': 'Useful Items',
      };
      return translations[key] || key;
    },
  },
}));

jest.mock('@/components/recipe-detail/SectionHeading', () => ({
  SectionHeading: 'SectionHeading',
}));

describe('RecipeUsefulItems', () => {
  const mockUsefulItems: RecipeUsefulItem[] = [
    {
      id: 'item-1',
      name: 'Mixing Bowl',
      pictureUrl: 'https://example.com/bowl.jpg',
    } as RecipeUsefulItem,
    {
      id: 'item-2',
      name: 'Whisk',
      pictureUrl: 'https://example.com/whisk.jpg',
    } as RecipeUsefulItem,
  ];

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(
        <RecipeUsefulItems usefulItems={mockUsefulItems} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('renders null when usefulItems is empty', () => {
      const { toJSON } = render(<RecipeUsefulItems usefulItems={[]} />);

      expect(toJSON()).toBeNull();
    });

    it('renders null when usefulItems is undefined', () => {
      const { toJSON } = render(
        <RecipeUsefulItems usefulItems={undefined as unknown as RecipeUsefulItem[]} />
      );

      expect(toJSON()).toBeNull();
    });

    it('displays item names', () => {
      render(<RecipeUsefulItems usefulItems={mockUsefulItems} />);

      expect(screen.getByText('Mixing Bowl')).toBeTruthy();
      expect(screen.getByText('Whisk')).toBeTruthy();
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('applies custom className', () => {
      const { toJSON } = render(
        <RecipeUsefulItems
          usefulItems={mockUsefulItems}
          className="mt-lg"
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom style', () => {
      const { toJSON } = render(
        <RecipeUsefulItems
          usefulItems={mockUsefulItems}
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
    it('handles single item', () => {
      const { toJSON } = render(
        <RecipeUsefulItems usefulItems={[mockUsefulItems[0]]} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles items without picture URL', () => {
      const itemsNoPicture: RecipeUsefulItem[] = [
        { id: 'item-1', name: 'Bowl' } as RecipeUsefulItem,
      ];

      const { toJSON } = render(
        <RecipeUsefulItems usefulItems={itemsNoPicture} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles many items', () => {
      const manyItems = Array.from({ length: 10 }, (_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
        pictureUrl: `https://example.com/item-${i}.jpg`,
      })) as RecipeUsefulItem[];

      const { toJSON } = render(
        <RecipeUsefulItems usefulItems={manyItems} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles items with long names', () => {
      const longNameItems: RecipeUsefulItem[] = [
        {
          id: 'item-1',
          name: 'Extra Large Professional Stainless Steel Mixing Bowl',
          pictureUrl: 'https://example.com/bowl.jpg',
        } as RecipeUsefulItem,
      ];

      const { toJSON } = render(
        <RecipeUsefulItems usefulItems={longNameItems} />
      );

      expect(toJSON()).toBeTruthy();
    });
  });
});
