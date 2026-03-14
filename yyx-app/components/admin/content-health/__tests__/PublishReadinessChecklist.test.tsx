import React from 'react';
import { Alert } from 'react-native';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/utils/render';
import { PublishReadinessChecklist } from '../PublishReadinessChecklist';
import { ContentHealthIssue } from '@/services/admin/adminContentHealthService';

const mockPublishRecipe = jest.fn();

jest.mock('@/services/admin/adminContentHealthService', () => ({
  adminContentHealthService: {
    publishRecipe: (...args: any[]) => mockPublishRecipe(...args),
  },
}));

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Ionicons: (props: any) => <View testID={`icon-${props.name}`} />,
  };
});

const mockAlert = jest.fn();
Alert.alert = mockAlert;

const readyIssue: ContentHealthIssue = {
  id: 'recipe-ready',
  entityType: 'recipe',
  name: 'Ready Recipe',
  imageUrl: 'https://img.com/recipe.jpg',
  isPublished: false,
  stepCount: 5,
  ingredientCount: 8,
  missingEn: false,
  missingEs: false,
  missingImage: false,
  missingNutrition: false,
};

const notReadyIssue: ContentHealthIssue = {
  id: 'recipe-not-ready',
  entityType: 'recipe',
  name: 'Not Ready Recipe',
  imageUrl: null,
  isPublished: false,
  stepCount: 0,
  ingredientCount: 8,
  missingEn: true,
  missingEs: false,
  missingImage: true,
  missingNutrition: false,
};

describe('PublishReadinessChecklist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPublishRecipe.mockResolvedValue(undefined);
  });

  it('renders all 5 checklist items', () => {
    renderWithProviders(
      <PublishReadinessChecklist issue={readyIssue} onPublished={jest.fn()} />
    );

    expect(screen.getByText('English name')).toBeTruthy();
    expect(screen.getByText('Spanish name')).toBeTruthy();
    expect(screen.getByText('Image')).toBeTruthy();
    expect(screen.getByText('Steps')).toBeTruthy();
    expect(screen.getByText('Ingredients')).toBeTruthy();
  });

  it('shows checkmark icons when checks pass and close icons when they fail', () => {
    renderWithProviders(
      <PublishReadinessChecklist issue={notReadyIssue} onPublished={jest.fn()} />
    );

    // notReadyIssue: missingEn + missingImage + stepCount=0 → 3 close, missingEs=false + ingredientCount=8 → 2 checkmark
    const closeIcons = screen.getAllByTestId('icon-close-circle');
    const checkIcons = screen.getAllByTestId('icon-checkmark-circle');
    expect(closeIcons).toHaveLength(3);
    expect(checkIcons).toHaveLength(2);
  });

  it('shows "Not ready" and disables publish when not all checks pass', () => {
    renderWithProviders(
      <PublishReadinessChecklist issue={notReadyIssue} onPublished={jest.fn()} />
    );

    expect(screen.getByText('Not ready')).toBeTruthy();
  });

  it('shows "Publish" button when all checks pass', () => {
    renderWithProviders(
      <PublishReadinessChecklist issue={readyIssue} onPublished={jest.fn()} />
    );

    expect(screen.getByText('Publish')).toBeTruthy();
  });

  it('does not call publishRecipe when not ready', () => {
    renderWithProviders(
      <PublishReadinessChecklist issue={notReadyIssue} onPublished={jest.fn()} />
    );

    fireEvent.press(screen.getByText('Not ready'));
    expect(mockPublishRecipe).not.toHaveBeenCalled();
  });

  it('calls publishRecipe and onPublished on successful publish', async () => {
    const onPublished = jest.fn();
    renderWithProviders(
      <PublishReadinessChecklist issue={readyIssue} onPublished={onPublished} />
    );

    fireEvent.press(screen.getByText('Publish'));

    await waitFor(() => {
      expect(mockPublishRecipe).toHaveBeenCalledWith('recipe-ready');
      expect(onPublished).toHaveBeenCalled();
    });
  });

  it('shows Alert on publish error', async () => {
    mockPublishRecipe.mockRejectedValue(new Error('Network failure'));
    const onPublished = jest.fn();

    renderWithProviders(
      <PublishReadinessChecklist issue={readyIssue} onPublished={onPublished} />
    );

    fireEvent.press(screen.getByText('Publish'));

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        expect.any(String),
        'Network failure'
      );
      expect(onPublished).not.toHaveBeenCalled();
    });
  });
});
