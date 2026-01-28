/**
 * CustomRecipeCard Component Tests
 *
 * Tests for the custom recipe card displayed when AI generates a recipe.
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { CustomRecipeCard } from '../CustomRecipeCard';
import * as Haptics from 'expo-haptics';
import {
  createMockGeneratedRecipe,
  createMockGeneratedRecipeWithManyIngredients,
  createMockSafetyFlags,
  createMockSafetyFlagsWithWarning,
  createMockSafetyFlagsWithError,
} from '@/test/mocks/chat';

// Mock expo-haptics
jest.mock('expo-haptics');

// Mock i18n
jest.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      'chat.customRecipe': 'Custom Recipe',
      'chat.startCooking': 'Start Cooking',
      'chat.saving': 'Saving...',
      'chat.editRecipeName': 'Tap to edit name',
      'chat.editRecipeNameHint': 'Enter a name for your recipe',
      'chat.recipeError': 'Recipe Error',
      'chat.warningPrefix': 'Warning',
      'chat.andMore': `and ${params?.count} more`,
      'common.minutesShort': 'min',
      'common.more': 'more',
      'recipes.common.difficulty.easy': 'Easy',
      'recipes.common.difficulty.medium': 'Medium',
      'recipes.common.difficulty.hard': 'Hard',
      'recipes.common.servings': 'servings',
      'recipes.common.ingredients': 'Ingredients',
    };
    return translations[key] || key;
  },
}));

describe('CustomRecipeCard', () => {
  const mockOnStartCooking = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnStartCooking.mockResolvedValue(undefined);
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  describe('rendering', () => {
    it('renders recipe name', () => {
      const recipe = createMockGeneratedRecipe({
        suggestedName: 'Garlic Butter Chicken',
      });

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      expect(screen.getByText('Garlic Butter Chicken')).toBeTruthy();
    });

    it('renders time, difficulty, and portions', () => {
      const recipe = createMockGeneratedRecipe({
        totalTime: 45,
        difficulty: 'medium',
        portions: 6,
      });

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      expect(screen.getByText('45 min')).toBeTruthy();
      expect(screen.getByText('Medium')).toBeTruthy();
      expect(screen.getByText('6')).toBeTruthy();
    });

    it('renders first 5 ingredients as chips', () => {
      const recipe = createMockGeneratedRecipe();

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      // First 5 ingredients should be accessible via the list's accessibility label
      // The ingredients are rendered inside a View with accessibilityElementsHidden
      // so we check the parent's accessibility label instead
      const ingredientsList = screen.getByLabelText(
        /Ingredients:.*chicken breast.*broccoli.*soy sauce.*garlic.*ginger/
      );
      expect(ingredientsList).toBeTruthy();
    });

    it('shows "+X more" badge when more than 5 ingredients', () => {
      const recipe = createMockGeneratedRecipeWithManyIngredients(8);

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      // 8 ingredients - 5 displayed = 3 more
      // Check accessibility label contains "and 3 more"
      const ingredientsList = screen.getByLabelText(/and 3 more/);
      expect(ingredientsList).toBeTruthy();
    });

    it('does not show "+X more" badge when 5 or fewer ingredients', () => {
      const recipe = createMockGeneratedRecipe(); // Has 5 ingredients

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      expect(screen.queryByText(/\+\d+ more/)).toBeNull();
    });

    it('renders custom recipe header', () => {
      const recipe = createMockGeneratedRecipe();

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      expect(screen.getByText('Custom Recipe')).toBeTruthy();
    });

    it('renders start cooking button', () => {
      const recipe = createMockGeneratedRecipe();

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      expect(screen.getByText('Start Cooking')).toBeTruthy();
    });
  });

  // ============================================================
  // DIFFICULTY DISPLAY TESTS
  // ============================================================

  describe('difficulty display', () => {
    it('displays easy difficulty correctly', () => {
      const recipe = createMockGeneratedRecipe({ difficulty: 'easy' });

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      expect(screen.getByText('Easy')).toBeTruthy();
    });

    it('displays medium difficulty correctly', () => {
      const recipe = createMockGeneratedRecipe({ difficulty: 'medium' });

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      expect(screen.getByText('Medium')).toBeTruthy();
    });

    it('displays hard difficulty correctly', () => {
      const recipe = createMockGeneratedRecipe({ difficulty: 'hard' });

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      expect(screen.getByText('Hard')).toBeTruthy();
    });
  });

  // ============================================================
  // EDITING TESTS
  // ============================================================

  describe('editing', () => {
    it('enters edit mode on name tap', () => {
      const recipe = createMockGeneratedRecipe({
        suggestedName: 'Original Name',
      });

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      // Tap on the name to enter edit mode
      fireEvent.press(screen.getByText('Original Name'));

      // Should show text input (we can verify by checking that haptic was called)
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });

    it('updates name on text change', () => {
      const recipe = createMockGeneratedRecipe({
        suggestedName: 'Original Name',
      });

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      // Enter edit mode
      fireEvent.press(screen.getByText('Original Name'));

      // Find the TextInput and change the value
      const textInput = screen.getByDisplayValue('Original Name');
      fireEvent.changeText(textInput, 'New Recipe Name');

      expect(screen.getByDisplayValue('New Recipe Name')).toBeTruthy();
    });

    it('exits edit mode on blur', () => {
      const recipe = createMockGeneratedRecipe({
        suggestedName: 'Original Name',
      });

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      // Enter edit mode
      fireEvent.press(screen.getByText('Original Name'));

      // Find the TextInput and blur it
      const textInput = screen.getByDisplayValue('Original Name');
      fireEvent(textInput, 'blur');

      // After blur, the text should still be visible (not in editing mode)
      expect(screen.getByText('Original Name')).toBeTruthy();
    });

    it('resets to suggested name if empty on blur', () => {
      const recipe = createMockGeneratedRecipe({
        suggestedName: 'Original Name',
      });

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      // Enter edit mode
      fireEvent.press(screen.getByText('Original Name'));

      // Clear the text
      const textInput = screen.getByDisplayValue('Original Name');
      fireEvent.changeText(textInput, '');

      // Blur to exit edit mode
      fireEvent(textInput, 'blur');

      // Should reset to original name
      expect(screen.getByText('Original Name')).toBeTruthy();
    });

    it('resets to suggested name if only whitespace on blur', () => {
      const recipe = createMockGeneratedRecipe({
        suggestedName: 'Original Name',
      });

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      // Enter edit mode
      fireEvent.press(screen.getByText('Original Name'));

      // Enter only whitespace
      const textInput = screen.getByDisplayValue('Original Name');
      fireEvent.changeText(textInput, '   ');

      // Blur to exit edit mode
      fireEvent(textInput, 'blur');

      // Should reset to original name
      expect(screen.getByText('Original Name')).toBeTruthy();
    });

    it('exits edit mode on submit', () => {
      const recipe = createMockGeneratedRecipe({
        suggestedName: 'Original Name',
      });

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      // Enter edit mode
      fireEvent.press(screen.getByText('Original Name'));

      // Find the TextInput and submit
      const textInput = screen.getByDisplayValue('Original Name');
      fireEvent.changeText(textInput, 'New Name');
      fireEvent(textInput, 'submitEditing');

      // Should show the new name as text
      expect(screen.getByText('New Name')).toBeTruthy();
    });
  });

  // ============================================================
  // INTERACTION TESTS
  // ============================================================

  describe('interactions', () => {
    it('calls onStartCooking with recipe and name when button pressed', async () => {
      const recipe = createMockGeneratedRecipe({
        suggestedName: 'Test Recipe',
      });

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      fireEvent.press(screen.getByText('Start Cooking'));

      await waitFor(() => {
        expect(mockOnStartCooking).toHaveBeenCalledWith(recipe, 'Test Recipe');
      });
    });

    it('calls onStartCooking with edited name', async () => {
      const recipe = createMockGeneratedRecipe({
        suggestedName: 'Original Name',
      });

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      // Edit the name
      fireEvent.press(screen.getByText('Original Name'));
      const textInput = screen.getByDisplayValue('Original Name');
      fireEvent.changeText(textInput, 'Edited Name');
      fireEvent(textInput, 'submitEditing');

      // Press start cooking
      fireEvent.press(screen.getByText('Start Cooking'));

      await waitFor(() => {
        expect(mockOnStartCooking).toHaveBeenCalledWith(recipe, 'Edited Name');
      });
    });

    it('shows loading state when isSaving', async () => {
      // Make onStartCooking take some time
      let resolvePromise: () => void;
      mockOnStartCooking.mockReturnValue(
        new Promise<void>((resolve) => {
          resolvePromise = resolve;
        })
      );

      const recipe = createMockGeneratedRecipe();

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      // Press start cooking
      fireEvent.press(screen.getByText('Start Cooking'));

      // Should show saving text
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeTruthy();
      });

      // Resolve the promise
      resolvePromise!();
    });

    it('shows loading state when loading prop is true', () => {
      const recipe = createMockGeneratedRecipe();

      render(
        <CustomRecipeCard
          recipe={recipe}
          onStartCooking={mockOnStartCooking}
          loading={true}
        />
      );

      expect(screen.getByText('Saving...')).toBeTruthy();
    });

    it('disables button when loading', () => {
      const recipe = createMockGeneratedRecipe();

      render(
        <CustomRecipeCard
          recipe={recipe}
          onStartCooking={mockOnStartCooking}
          loading={true}
        />
      );

      // Try to press the button multiple times
      fireEvent.press(screen.getByText('Saving...'));
      fireEvent.press(screen.getByText('Saving...'));

      // onStartCooking should not be called because button is disabled
      expect(mockOnStartCooking).not.toHaveBeenCalled();
    });

    it('triggers haptic on edit press', () => {
      const recipe = createMockGeneratedRecipe();

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      fireEvent.press(screen.getByText(recipe.suggestedName));

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });

    it('triggers haptic on start cooking press', async () => {
      const recipe = createMockGeneratedRecipe();

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      fireEvent.press(screen.getByText('Start Cooking'));

      await waitFor(() => {
        expect(Haptics.impactAsync).toHaveBeenCalledWith(
          Haptics.ImpactFeedbackStyle.Medium
        );
      });
    });
  });

  // ============================================================
  // SAFETY FLAGS TESTS
  // ============================================================

  describe('safety flags', () => {
    it('renders allergen warning when present and not error', () => {
      const recipe = createMockGeneratedRecipe();
      const safetyFlags = createMockSafetyFlagsWithWarning(
        'This recipe contains nuts'
      );

      render(
        <CustomRecipeCard
          recipe={recipe}
          safetyFlags={safetyFlags}
          onStartCooking={mockOnStartCooking}
        />
      );

      expect(screen.getByText('This recipe contains nuts')).toBeTruthy();
    });

    it('renders error state when safetyFlags.error is true', () => {
      const recipe = createMockGeneratedRecipe();
      const safetyFlags = createMockSafetyFlagsWithError(
        'Contains allergens you are allergic to'
      );

      render(
        <CustomRecipeCard
          recipe={recipe}
          safetyFlags={safetyFlags}
          onStartCooking={mockOnStartCooking}
        />
      );

      expect(screen.getByText('Recipe Error')).toBeTruthy();
      expect(
        screen.getByText('Contains allergens you are allergic to')
      ).toBeTruthy();
    });

    it('renders dietary conflict in error state', () => {
      const recipe = createMockGeneratedRecipe();
      const safetyFlags = createMockSafetyFlagsWithError(
        undefined,
        'This recipe is not vegetarian'
      );

      render(
        <CustomRecipeCard
          recipe={recipe}
          safetyFlags={safetyFlags}
          onStartCooking={mockOnStartCooking}
        />
      );

      expect(screen.getByText('Recipe Error')).toBeTruthy();
      expect(screen.getByText('This recipe is not vegetarian')).toBeTruthy();
    });

    it('does not render recipe content in error state', () => {
      const recipe = createMockGeneratedRecipe({
        suggestedName: 'Hidden Recipe',
      });
      const safetyFlags = createMockSafetyFlagsWithError('Error message');

      render(
        <CustomRecipeCard
          recipe={recipe}
          safetyFlags={safetyFlags}
          onStartCooking={mockOnStartCooking}
        />
      );

      // Recipe name should not be visible
      expect(screen.queryByText('Hidden Recipe')).toBeNull();
      // Start cooking button should not be visible
      expect(screen.queryByText('Start Cooking')).toBeNull();
    });

    it('renders normally without safety flags', () => {
      const recipe = createMockGeneratedRecipe();

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      // Should render normally
      expect(screen.getByText(recipe.suggestedName)).toBeTruthy();
      expect(screen.getByText('Start Cooking')).toBeTruthy();
    });
  });

  // ============================================================
  // ACCESSIBILITY TESTS
  // ============================================================

  describe('accessibility', () => {
    it('has correct accessibilityRole on card', () => {
      const recipe = createMockGeneratedRecipe();

      const { getByRole } = render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      // The card should have article role - note: RNTL may need accessibilityRole query
      expect(screen.getByRole('article')).toBeTruthy();
    });

    it('has descriptive accessibilityLabel on card', () => {
      const recipe = createMockGeneratedRecipe({
        suggestedName: 'Test Recipe',
        totalTime: 30,
        difficulty: 'easy',
        portions: 4,
      });

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      const card = screen.getByRole('article');
      expect(card.props.accessibilityLabel).toContain('Test Recipe');
      expect(card.props.accessibilityLabel).toContain('30');
      expect(card.props.accessibilityLabel).toContain('Easy');
      expect(card.props.accessibilityLabel).toContain('4');
    });

    it('has correct accessibilityLabel on edit button', () => {
      const recipe = createMockGeneratedRecipe({
        suggestedName: 'My Recipe',
      });

      render(
        <CustomRecipeCard recipe={recipe} onStartCooking={mockOnStartCooking} />
      );

      const editButton = screen.getByRole('button', {
        name: /My Recipe.*Tap to edit name/,
      });
      expect(editButton).toBeTruthy();
    });

    it('has correct accessibilityState on disabled button', () => {
      const recipe = createMockGeneratedRecipe();

      render(
        <CustomRecipeCard
          recipe={recipe}
          onStartCooking={mockOnStartCooking}
          loading={true}
        />
      );

      // The button should indicate it's disabled
      // Note: Button component may have different accessibility patterns
      const savingButton = screen.getByLabelText('Saving...');
      expect(savingButton.props.accessibilityState?.disabled).toBe(true);
    });

    it('has alert role on safety warning', () => {
      const recipe = createMockGeneratedRecipe();
      const safetyFlags = createMockSafetyFlagsWithWarning('Warning message');

      render(
        <CustomRecipeCard
          recipe={recipe}
          safetyFlags={safetyFlags}
          onStartCooking={mockOnStartCooking}
        />
      );

      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });
});
