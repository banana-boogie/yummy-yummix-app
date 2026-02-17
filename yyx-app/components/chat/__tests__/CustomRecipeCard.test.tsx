import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { CustomRecipeCard } from '../CustomRecipeCard';
import {
  createMockGeneratedRecipe,
  createMockSafetyFlagsWithWarning,
} from '@/test/mocks/chat';

jest.mock('expo-haptics');

jest.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      'chat.customRecipe': 'Custom Recipe',
      'chat.startCooking': 'Start Cooking',
      'chat.seeFullRecipe': 'See Full Recipe',
      'chat.ingredientsSummary': `${params?.count} ingredients`,
      'chat.stepsSummary': `${params?.count} steps`,
      'chat.aiGeneratedRecipe': 'AI-generated recipe',
      'chat.aiGeneratedDisclaimer': 'This recipe was created by AI.',
      'chat.editRecipeName': 'Tap to edit name',
      'chat.editRecipeNameHint': 'Enter a name for your recipe',
      'chat.warningPrefix': 'Warning',
      'chat.recipeError': 'Unable to create recipe',
      'chat.error.recipeGeneration': 'Recipe generation failed',
      'chat.andMore': `and ${params?.count} more`,
      'common.minutesShort': 'min',
      'common.showAll': `Show ${params?.count} more`,
      'common.showLess': 'Show less',
      'recipes.common.ingredients': 'Ingredients',
      'recipes.common.instructions': 'Instructions',
      'recipes.common.steps': 'steps',
      'recipes.common.usefulItems': 'Useful Items',
      'recipes.common.servings': 'servings',
      'recipes.common.difficulty.easy': 'Easy',
      'recipes.common.difficulty.medium': 'Medium',
      'recipes.common.difficulty.hard': 'Hard',
    };

    return translations[key] || key;
  },
}));

describe('CustomRecipeCard', () => {
  const onStartCooking = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders compact view by default', () => {
    const recipe = createMockGeneratedRecipe();

    render(
      <CustomRecipeCard
        recipe={recipe}
        onStartCooking={onStartCooking}
        messageId="msg-1"
      />
    );

    expect(screen.getByText('See Full Recipe')).toBeTruthy();
    expect(screen.getByText(/5 ingredients/)).toBeTruthy();
    expect(screen.getByText(/3 steps/)).toBeTruthy();
    expect(screen.queryByText('Ingredients:')).toBeNull();
  });

  it('expands to full recipe when pressing "See Full Recipe"', () => {
    const recipe = createMockGeneratedRecipe();

    render(
      <CustomRecipeCard
        recipe={recipe}
        onStartCooking={onStartCooking}
        messageId="msg-1"
      />
    );

    fireEvent.press(screen.getByText('See Full Recipe'));

    expect(screen.getByText('Ingredients:')).toBeTruthy();
    expect(screen.getByText('Instructions:')).toBeTruthy();
  });

  it('renders description when present', () => {
    const recipe = createMockGeneratedRecipe({
      description: 'A quick and savory weekday dinner.',
    });

    render(
      <CustomRecipeCard
        recipe={recipe}
        onStartCooking={onStartCooking}
        messageId="msg-1"
      />
    );

    expect(screen.getByText('A quick and savory weekday dinner.')).toBeTruthy();
  });

  it('does not render description when absent', () => {
    const recipe = createMockGeneratedRecipe({
      description: undefined,
    });

    render(
      <CustomRecipeCard
        recipe={recipe}
        onStartCooking={onStartCooking}
        messageId="msg-1"
      />
    );

    expect(screen.queryByText('A quick and savory weekday dinner.')).toBeNull();
  });

  it('toggles AI disclaimer when badge is pressed', () => {
    const recipe = createMockGeneratedRecipe();

    render(
      <CustomRecipeCard
        recipe={recipe}
        onStartCooking={onStartCooking}
        messageId="msg-1"
      />
    );

    expect(screen.queryByText('This recipe was created by AI.')).toBeNull();

    fireEvent.press(screen.getByText('AI-generated recipe'));
    expect(screen.getByText('This recipe was created by AI.')).toBeTruthy();

    fireEvent.press(screen.getByText('AI-generated recipe'));
    expect(screen.queryByText('This recipe was created by AI.')).toBeNull();
  });

  it('keeps safety warning visible in compact and expanded views', () => {
    const recipe = createMockGeneratedRecipe();
    const warning = 'May contain nuts';

    render(
      <CustomRecipeCard
        recipe={recipe}
        safetyFlags={createMockSafetyFlagsWithWarning(warning)}
        onStartCooking={onStartCooking}
        messageId="msg-1"
      />
    );

    expect(screen.getByText(warning)).toBeTruthy();

    fireEvent.press(screen.getByText('See Full Recipe'));
    expect(screen.getByText(warning)).toBeTruthy();
  });

  it('calls onStartCooking with recipe, final name, message id, and savedRecipeId', () => {
    const recipe = createMockGeneratedRecipe({ suggestedName: 'Test Recipe' });

    render(
      <CustomRecipeCard
        recipe={recipe}
        onStartCooking={onStartCooking}
        messageId="msg-123"
        savedRecipeId="saved-1"
      />
    );

    fireEvent.press(screen.getByText('Start Cooking'));

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    expect(onStartCooking).toHaveBeenCalledWith(recipe, 'Test Recipe', 'msg-123', 'saved-1');
  });
});
