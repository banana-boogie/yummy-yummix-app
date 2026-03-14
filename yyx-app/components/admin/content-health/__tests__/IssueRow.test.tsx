import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test/utils/render';
import { IssueRow } from '../IssueRow';
import { ContentHealthIssue } from '@/services/admin/adminContentHealthService';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Ionicons: (props: any) => <View testID={`icon-${props.name}`} />,
  };
});

jest.mock('@/services/admin/adminContentHealthService', () => ({
  adminContentHealthService: {
    publishRecipe: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockRecipeIssue: ContentHealthIssue = {
  id: 'recipe-1',
  entityType: 'recipe',
  name: 'Pasta Carbonara',
  imageUrl: null,
  isPublished: false,
  stepCount: 5,
  ingredientCount: 8,
  missingEn: false,
  missingEs: true,
  missingImage: true,
  missingNutrition: false,
};

const mockIngredientIssue: ContentHealthIssue = {
  id: 'ing-1',
  entityType: 'ingredient',
  name: 'Tomato',
  imageUrl: null,
  isPublished: null,
  stepCount: null,
  ingredientCount: null,
  missingEn: true,
  missingEs: false,
  missingImage: false,
  missingNutrition: true,
};

describe('IssueRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders entity name and issue badges', () => {
    renderWithProviders(
      <IssueRow issue={mockRecipeIssue} onPublished={jest.fn()} />
    );

    expect(screen.getByText('Pasta Carbonara')).toBeTruthy();
    // Should show "No ES", "No Image", and "Draft" badges
    expect(screen.getByText('No ES')).toBeTruthy();
    expect(screen.getByText('No Image')).toBeTruthy();
    expect(screen.getByText('Draft')).toBeTruthy();
  });

  it('navigates to recipe edit on Fix press', () => {
    renderWithProviders(
      <IssueRow issue={mockRecipeIssue} onPublished={jest.fn()} />
    );

    fireEvent.press(screen.getByText('Fix'));
    expect(mockPush).toHaveBeenCalledWith('/admin/recipes/recipe-1');
  });

  it('navigates to ingredient edit on Fix press', () => {
    renderWithProviders(
      <IssueRow issue={mockIngredientIssue} onPublished={jest.fn()} />
    );

    fireEvent.press(screen.getByText('Fix'));
    expect(mockPush).toHaveBeenCalledWith('/admin/ingredients/ing-1');
  });

  it('shows ingredient badges correctly', () => {
    renderWithProviders(
      <IssueRow issue={mockIngredientIssue} onPublished={jest.fn()} />
    );

    expect(screen.getByText('Tomato')).toBeTruthy();
    expect(screen.getByText('No EN')).toBeTruthy();
    expect(screen.getByText('No Nutrition')).toBeTruthy();
  });
});
