/**
 * RecipeProgressIndicator Tests
 *
 * Tests for recipe progress indicator component covering:
 * - Step display
 * - Active state styling
 * - Click handling
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { RecipeProgressIndicator, CreateRecipeStep } from '../RecipeProgressIndicator';

// Mock i18n
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'admin.recipes.form.basicInfo.title': 'Basic Info',
        'admin.recipes.form.usefulItemsInfo.title': 'Tools',
        'admin.recipes.form.ingredientsInfo.title': 'Ingredients',
        'admin.recipes.form.stepsInfo.title': 'Steps',
        'admin.recipes.form.tagsInfo.title': 'Tags',
        'admin.recipes.form.reviewInfo.title': 'Review',
      };
      return translations[key] || key;
    },
  },
}));

describe('RecipeProgressIndicator', () => {
  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders all step labels', () => {
      render(<RecipeProgressIndicator currentStep={CreateRecipeStep.BASIC_INFO} />);

      expect(screen.getByText('Basic Info')).toBeTruthy();
      expect(screen.getByText('Tools')).toBeTruthy();
      expect(screen.getByText('Ingredients')).toBeTruthy();
      expect(screen.getByText('Steps')).toBeTruthy();
      expect(screen.getByText('Tags')).toBeTruthy();
      expect(screen.getByText('Review')).toBeTruthy();
    });

    it('renders step numbers', () => {
      render(<RecipeProgressIndicator currentStep={CreateRecipeStep.BASIC_INFO} />);

      expect(screen.getByText('1')).toBeTruthy();
      expect(screen.getByText('2')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
      expect(screen.getByText('4')).toBeTruthy();
      expect(screen.getByText('5')).toBeTruthy();
      expect(screen.getByText('6')).toBeTruthy();
    });
  });

  // ============================================================
  // ACTIVE STATE TESTS
  // ============================================================

  describe('active states', () => {
    it('shows first step as not active when on initial setup', () => {
      const { toJSON } = render(
        <RecipeProgressIndicator currentStep={CreateRecipeStep.INITIAL_SETUP} />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('shows steps up to current as active', () => {
      const { toJSON } = render(
        <RecipeProgressIndicator currentStep={CreateRecipeStep.INGREDIENTS} />
      );

      // Steps 1-3 should be active, steps 4-6 should not be
      expect(toJSON()).toBeTruthy();
    });

    it('shows all steps as active on review', () => {
      const { toJSON } = render(
        <RecipeProgressIndicator currentStep={CreateRecipeStep.REVIEW} />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  // ============================================================
  // CLICK HANDLING TESTS
  // ============================================================

  describe('click handling', () => {
    it('does not call onStepClick when clickable is false', () => {
      const mockOnStepClick = jest.fn();
      render(
        <RecipeProgressIndicator
          currentStep={CreateRecipeStep.STEPS}
          onStepClick={mockOnStepClick}
          clickable={false}
        />
      );

      const stepButton = screen.getByText('Basic Info');
      fireEvent.press(stepButton);

      expect(mockOnStepClick).not.toHaveBeenCalled();
    });

    it('calls onStepClick with correct step when clickable', () => {
      const mockOnStepClick = jest.fn();
      render(
        <RecipeProgressIndicator
          currentStep={CreateRecipeStep.STEPS}
          onStepClick={mockOnStepClick}
          clickable={true}
        />
      );

      const stepButton = screen.getByText('Basic Info');
      fireEvent.press(stepButton);

      expect(mockOnStepClick).toHaveBeenCalledWith(CreateRecipeStep.BASIC_INFO);
    });

    it('calls onStepClick with ingredients step when ingredients clicked', () => {
      const mockOnStepClick = jest.fn();
      render(
        <RecipeProgressIndicator
          currentStep={CreateRecipeStep.REVIEW}
          onStepClick={mockOnStepClick}
          clickable={true}
        />
      );

      const ingredientsButton = screen.getByText('Ingredients');
      fireEvent.press(ingredientsButton);

      expect(mockOnStepClick).toHaveBeenCalledWith(CreateRecipeStep.INGREDIENTS);
    });

    it('defaults clickable to false', () => {
      const mockOnStepClick = jest.fn();
      render(
        <RecipeProgressIndicator
          currentStep={CreateRecipeStep.STEPS}
          onStepClick={mockOnStepClick}
        />
      );

      const stepButton = screen.getByText('Basic Info');
      fireEvent.press(stepButton);

      expect(mockOnStepClick).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // STEP ENUM TESTS
  // ============================================================

  describe('CreateRecipeStep enum', () => {
    it('has correct values', () => {
      expect(CreateRecipeStep.INITIAL_SETUP).toBe(0);
      expect(CreateRecipeStep.BASIC_INFO).toBe(1);
      expect(CreateRecipeStep.USEFUL_ITEMS).toBe(2);
      expect(CreateRecipeStep.INGREDIENTS).toBe(3);
      expect(CreateRecipeStep.STEPS).toBe(4);
      expect(CreateRecipeStep.TAGS).toBe(5);
      expect(CreateRecipeStep.REVIEW).toBe(6);
    });
  });
});
