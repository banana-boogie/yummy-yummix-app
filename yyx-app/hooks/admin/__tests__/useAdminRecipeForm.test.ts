/**
 * useAdminRecipeForm Hook Tests
 *
 * Regression coverage for My Week Setup planner metadata persistence on
 * recipe CREATE. Previously handlePublish() dropped planner fields on the
 * floor — this test asserts they all reach adminRecipeService.createRecipe.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useAdminRecipeForm, migrateDraftStep } from '../useAdminRecipeForm';
import { CreateRecipeStep } from '@/components/admin/recipes/RecipeProgressIndicator';

// ---- Mocks --------------------------------------------------------------

const mockCreateRecipe = jest.fn();

jest.mock('@/services/admin/adminRecipeService', () => ({
  __esModule: true,
  adminRecipeService: {
    createRecipe: (...args: any[]) => mockCreateRecipe(...args),
  },
  default: {
    createRecipe: (...args: any[]) => mockCreateRecipe(...args),
  },
}));

jest.mock('@/services/storage/imageService', () => ({
  __esModule: true,
  imageService: {
    uploadImage: jest.fn().mockResolvedValue('https://example.com/img.png'),
  },
}));

jest.mock('./useRecipeValidation', () => ({
  useRecipeValidation: () => ({
    validateBasicInfo: jest.fn().mockReturnValue({}),
    validateIngredients: jest.fn().mockReturnValue({}),
    validateSteps: jest.fn().mockReturnValue({}),
    validateTags: jest.fn().mockReturnValue({}),
  }),
}), { virtual: true });

jest.mock('../useRecipeValidation', () => ({
  useRecipeValidation: () => ({
    validateBasicInfo: jest.fn().mockReturnValue({}),
    validateIngredients: jest.fn().mockReturnValue({}),
    validateSteps: jest.fn().mockReturnValue({}),
    validateTags: jest.fn().mockReturnValue({}),
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/services/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock('@/components/admin/recipes/forms/shared/AuthoringLanguagePicker', () => ({
  loadAuthoringLocale: jest.fn().mockResolvedValue('en'),
  saveAuthoringLocale: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: {
    locale: 'en',
    t: (k: string) => k,
  },
}));

// ---- Test ---------------------------------------------------------------

describe('useAdminRecipeForm — create flow persists My Week Setup', () => {
  beforeEach(() => {
    mockCreateRecipe.mockReset();
    mockCreateRecipe.mockResolvedValue({ id: 'recipe-1' });
  });

  it('passes all planner metadata fields to createRecipe on publish', async () => {
    const onPublishSuccess = jest.fn();
    const onPublishError = jest.fn();

    const { result } = renderHook(() =>
      useAdminRecipeForm({ onPublishSuccess, onPublishError })
    );

    // Populate planner metadata via updateRecipe
    act(() => {
      result.current.updateRecipe({
        translations: [{ locale: 'en', name: 'Test Recipe' }],
        pictureUrl: 'https://example.com/existing.png',
        difficulty: 'easy' as any,
        prepTime: 10,
        totalTime: 30,
        portions: 4,
        isPublished: true,
        ingredients: [],
        tags: [],
        steps: [],
        kitchenTools: [],
        plannerRole: 'main' as any,
        foodGroups: ['protein', 'carb'] as any,
        isCompleteMeal: true,
        equipmentTags: ['thermomix'] as any,
        cookingLevel: 'intermediate' as any,
        leftoversFriendly: true,
        batchFriendly: false,
        maxHouseholdSizeSupported: 6,
        requiresMultiBatchNote: 'Double batch requires 2 bowls',
        verifiedAt: '2026-04-13T00:00:00.000Z',
        verifiedBy: 'user-abc',
      });
    });

    await act(async () => {
      await result.current.handlePublish();
    });

    expect(mockCreateRecipe).toHaveBeenCalledTimes(1);
    const payload = mockCreateRecipe.mock.calls[0][0];

    // Regression: all My Week Setup fields must reach the service layer.
    expect(payload).toMatchObject({
      plannerRole: 'main',
      foodGroups: ['protein', 'carb'],
      isCompleteMeal: true,
      equipmentTags: ['thermomix'],
      cookingLevel: 'intermediate',
      leftoversFriendly: true,
      batchFriendly: false,
      maxHouseholdSizeSupported: 6,
      requiresMultiBatchNote: 'Double batch requires 2 bowls',
      verifiedAt: '2026-04-13T00:00:00.000Z',
      verifiedBy: 'user-abc',
    });

    expect(onPublishError).not.toHaveBeenCalled();
    expect(onPublishSuccess).toHaveBeenCalled();
  });
});

describe('migrateDraftStep — draft schema migration', () => {
  it('shifts v1 TRANSLATIONS (6) to v2 TRANSLATIONS (7)', () => {
    expect(migrateDraftStep(6, 1)).toBe(CreateRecipeStep.TRANSLATIONS);
  });

  it('shifts v1 REVIEW (7) to v2 REVIEW (8)', () => {
    expect(migrateDraftStep(7, 1)).toBe(CreateRecipeStep.REVIEW);
  });

  it('leaves unchanged steps alone on v1→v2 (step < 6)', () => {
    expect(migrateDraftStep(0, 1)).toBe(CreateRecipeStep.INITIAL_SETUP);
    expect(migrateDraftStep(5, 1)).toBe(CreateRecipeStep.TAGS);
  });

  it('does not shift when already on current version', () => {
    expect(migrateDraftStep(6, 2)).toBe(CreateRecipeStep.MY_WEEK_SETUP);
    expect(migrateDraftStep(7, 2)).toBe(CreateRecipeStep.TRANSLATIONS);
    expect(migrateDraftStep(8, 2)).toBe(CreateRecipeStep.REVIEW);
  });

  it('clamps out-of-range step values back to INITIAL_SETUP', () => {
    expect(migrateDraftStep(99, 1)).toBe(CreateRecipeStep.INITIAL_SETUP);
    expect(migrateDraftStep(-1, 1)).toBe(CreateRecipeStep.INITIAL_SETUP);
    expect(migrateDraftStep(Number.NaN, 1)).toBe(CreateRecipeStep.INITIAL_SETUP);
  });
});
