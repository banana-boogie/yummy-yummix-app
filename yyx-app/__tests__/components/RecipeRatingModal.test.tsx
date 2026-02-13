import React from 'react';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/utils/render';
import { RecipeRatingModal } from '@/components/rating/RecipeRatingModal';

// Mock the useRecipeRating hook
const mockSubmitRatingAsync = jest.fn();
const mockSubmitFeedbackAsync = jest.fn();

jest.mock('@/hooks/useRecipeRating', () => ({
  useRecipeRating: () => ({
    userRating: null,
    submitRatingAsync: mockSubmitRatingAsync,
    submitFeedbackAsync: mockSubmitFeedbackAsync,
    isSubmittingRating: false,
    isSubmittingFeedback: false,
  }),
}));

jest.mock('@/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'recipes.rating.howWasIt': 'How was it?',
      'recipes.rating.feedbackLabel': 'Any feedback? (optional)',
      'recipes.rating.feedbackPlaceholder': 'Tell us what you think...',
      'recipes.rating.skip': 'Skip',
      'recipes.rating.submit': 'Submit',
      'recipes.rating.pleaseSelectRating': 'Please select a rating',
      'recipes.rating.submitError': 'Something went wrong',
      'recipes.rating.thankYou': 'Thank you!',
      'recipes.rating.rateStar': '1 star',
      'recipes.rating.rateStars': 'stars',
    };
    return translations[key] || key;
  },
}));

describe('RecipeRatingModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    recipeId: 'recipe-123',
    recipeName: 'Test Recipe',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSubmitRatingAsync.mockResolvedValue(undefined);
    mockSubmitFeedbackAsync.mockResolvedValue(undefined);
  });

  it('should render the modal with recipe name', () => {
    renderWithProviders(<RecipeRatingModal {...defaultProps} />);

    expect(screen.getByText('How was it?')).toBeTruthy();
    expect(screen.getByText('Test Recipe')).toBeTruthy();
  });

  it('should render skip and submit buttons', () => {
    renderWithProviders(<RecipeRatingModal {...defaultProps} />);

    expect(screen.getByText('Skip')).toBeTruthy();
    expect(screen.getByText('Submit')).toBeTruthy();
  });

  it('should call onClose when skip is pressed', async () => {
    renderWithProviders(<RecipeRatingModal {...defaultProps} />);

    fireEvent.press(screen.getByText('Skip'));

    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('should not render when not visible', () => {
    renderWithProviders(<RecipeRatingModal {...defaultProps} visible={false} />);

    expect(screen.queryByText('How was it?')).toBeNull();
  });

  it('should render feedback input', () => {
    renderWithProviders(<RecipeRatingModal {...defaultProps} />);

    expect(screen.getByText('Any feedback? (optional)')).toBeTruthy();
    expect(screen.getByPlaceholderText('Tell us what you think...')).toBeTruthy();
  });

  it('should render 5 star buttons', () => {
    renderWithProviders(<RecipeRatingModal {...defaultProps} />);

    // All stars should be unselected initially (rating = 0)
    const starButtons = screen.getAllByRole('button').filter(
      (btn) => btn.props.accessibilityLabel?.includes('star')
    );
    expect(starButtons.length).toBe(5);
  });
});
