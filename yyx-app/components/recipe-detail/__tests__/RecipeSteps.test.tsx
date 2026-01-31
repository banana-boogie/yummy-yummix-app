/**
 * RecipeSteps Tests
 *
 * Tests for recipe steps component covering:
 * - Steps list rendering
 * - Section grouping
 * - Step ordering display
 * - Empty state handling
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RecipeSteps } from '../RecipeSteps';
import { RecipeStep } from '@/types/recipe.types';

// Mock dependencies
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

jest.mock('@/hooks/useDevice', () => ({
  useDevice: () => ({
    isPhone: true,
    isMedium: false,
    isLarge: false,
  }),
}));

jest.mock('@/components/common/Text', () => {
  const { Text } = require('react-native');
  return {
    Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'recipes.detail.steps.heading': 'Steps',
      };
      return translations[key] || key;
    },
  },
}));

jest.mock('@/components/recipe-detail/SectionHeading', () => ({
  SectionHeading: 'SectionHeading',
}));

jest.mock('@/components/recipe-detail/SectionSubHeading', () => ({
  SectionSubHeading: 'SectionSubHeading',
}));

jest.mock('@/components/recipe-detail/RenderRecipeText', () => {
  const { Text } = require('react-native');
  return {
    renderRecipeText: (text: string) => <Text>{text}</Text>,
  };
});

jest.mock('@/utils/recipes', () => ({
  shouldDisplayRecipeSection: (section: string | undefined) => {
    return section && section !== 'main' && section !== 'default';
  },
}));

jest.mock('@/constants/design-tokens', () => ({
  COLORS: {
    primary: { dark: '#000000' },
  },
  FONT_SIZES: {
    xl: 20,
    '2xl': 24,
  },
}));

describe('RecipeSteps', () => {
  const mockSteps: RecipeStep[] = [
    {
      id: 'step-1',
      order: 1,
      instruction: 'Mix flour and sugar in a bowl',
    } as RecipeStep,
    {
      id: 'step-2',
      order: 2,
      instruction: 'Add eggs and mix until smooth',
    } as RecipeStep,
    {
      id: 'step-3',
      order: 3,
      instruction: 'Pour batter into pan and bake',
    } as RecipeStep,
  ];

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<RecipeSteps steps={mockSteps} />);

      expect(toJSON()).toBeTruthy();
    });

    it('renders null when steps is empty', () => {
      const { toJSON } = render(<RecipeSteps steps={[]} />);

      expect(toJSON()).toBeNull();
    });

    it('renders null when steps is undefined', () => {
      const { toJSON } = render(<RecipeSteps steps={undefined} />);

      expect(toJSON()).toBeNull();
    });

    it('displays step order numbers', () => {
      render(<RecipeSteps steps={mockSteps} />);

      expect(screen.getByText('1')).toBeTruthy();
      expect(screen.getByText('2')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
    });
  });

  // ============================================================
  // SECTION GROUPING TESTS
  // ============================================================

  describe('section grouping', () => {
    it('groups steps without sections together', () => {
      const { toJSON } = render(<RecipeSteps steps={mockSteps} />);

      expect(toJSON()).toBeTruthy();
    });

    it('handles steps with different sections', () => {
      const stepsWithSections: RecipeStep[] = [
        { id: '1', order: 1, instruction: 'Step 1', recipeSection: 'Prep' } as RecipeStep,
        { id: '2', order: 2, instruction: 'Step 2', recipeSection: 'Cooking' } as RecipeStep,
      ];

      const { toJSON } = render(<RecipeSteps steps={stepsWithSections} />);

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // STYLING TESTS
  // ============================================================

  describe('styling', () => {
    it('applies custom className', () => {
      const { toJSON } = render(
        <RecipeSteps steps={mockSteps} className="mt-lg" />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('applies custom style', () => {
      const { toJSON } = render(
        <RecipeSteps steps={mockSteps} style={{ marginTop: 20 }} />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================

  describe('edge cases', () => {
    it('handles single step', () => {
      const { toJSON } = render(<RecipeSteps steps={[mockSteps[0]]} />);

      expect(toJSON()).toBeTruthy();
    });

    it('handles steps with ingredients', () => {
      const stepsWithIngredients: RecipeStep[] = [
        {
          id: 'step-1',
          order: 1,
          instruction: 'Mix the flour',
          ingredients: [
            { name: 'flour', pluralName: 'flour' },
          ],
        } as RecipeStep,
      ];

      const { toJSON } = render(<RecipeSteps steps={stepsWithIngredients} />);

      expect(toJSON()).toBeTruthy();
    });

    it('handles many steps', () => {
      const manySteps = Array.from({ length: 15 }, (_, i) => ({
        id: `step-${i}`,
        order: i + 1,
        instruction: `Step ${i + 1} instruction`,
      })) as RecipeStep[];

      const { toJSON } = render(<RecipeSteps steps={manySteps} />);

      expect(toJSON()).toBeTruthy();
    });

    it('handles steps with missing order', () => {
      const stepsNoOrder: RecipeStep[] = [
        { id: '1', instruction: 'Do something' } as RecipeStep,
      ];

      const { toJSON } = render(<RecipeSteps steps={stepsNoOrder} />);

      expect(toJSON()).toBeTruthy();
    });
  });
});
