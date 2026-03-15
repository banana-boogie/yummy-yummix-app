/**
 * RecipeKitchenTools Tests
 *
 * Tests for recipe kitchen tools component covering:
 * - Items list rendering
 * - Image display
 * - Empty state handling
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RecipeKitchenTools } from '../RecipeKitchenTools';
import { RecipeKitchenTool } from '@/types/recipe.types';

// Mock dependencies
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'recipes.detail.kitchenTools.heading': 'Kitchen Tools',
      };
      return translations[key] || key;
    },
  },
}));

jest.mock('@/components/recipe-detail/SectionHeading', () => ({
  SectionHeading: 'SectionHeading',
}));

describe('RecipeKitchenTools', () => {
  const mockKitchenTools: RecipeKitchenTool[] = [
    {
      id: 'item-1',
      name: 'Mixing Bowl',
      pictureUrl: 'https://example.com/bowl.jpg',
    } as RecipeKitchenTool,
    {
      id: 'item-2',
      name: 'Whisk',
      pictureUrl: 'https://example.com/whisk.jpg',
    } as RecipeKitchenTool,
  ];

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(
        <RecipeKitchenTools kitchenTools={mockKitchenTools} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('renders null when kitchenTools is empty', () => {
      const { toJSON } = render(<RecipeKitchenTools kitchenTools={[]} />);

      expect(toJSON()).toBeNull();
    });

    it('renders null when kitchenTools is undefined', () => {
      const { toJSON } = render(
        <RecipeKitchenTools kitchenTools={undefined as unknown as RecipeKitchenTool[]} />
      );

      expect(toJSON()).toBeNull();
    });

    it('displays item names', () => {
      render(<RecipeKitchenTools kitchenTools={mockKitchenTools} />);

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
        <RecipeKitchenTools
          kitchenTools={mockKitchenTools}
          className="mt-lg"
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom style', () => {
      const { toJSON } = render(
        <RecipeKitchenTools
          kitchenTools={mockKitchenTools}
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
        <RecipeKitchenTools kitchenTools={[mockKitchenTools[0]]} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles items without picture URL', () => {
      const itemsNoPicture: RecipeKitchenTool[] = [
        { id: 'item-1', name: 'Bowl' } as RecipeKitchenTool,
      ];

      const { toJSON } = render(
        <RecipeKitchenTools kitchenTools={itemsNoPicture} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles many items', () => {
      const manyItems = Array.from({ length: 10 }, (_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
        pictureUrl: `https://example.com/item-${i}.jpg`,
      })) as RecipeKitchenTool[];

      const { toJSON } = render(
        <RecipeKitchenTools kitchenTools={manyItems} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('handles items with long names', () => {
      const longNameItems: RecipeKitchenTool[] = [
        {
          id: 'item-1',
          name: 'Extra Large Professional Stainless Steel Mixing Bowl',
          pictureUrl: 'https://example.com/bowl.jpg',
        } as RecipeKitchenTool,
      ];

      const { toJSON } = render(
        <RecipeKitchenTools kitchenTools={longNameItems} />
      );

      expect(toJSON()).toBeTruthy();
    });
  });
});
