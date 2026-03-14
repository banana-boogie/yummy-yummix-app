import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useContentHealth } from '../useContentHealth';

const mockGetContentHealth = jest.fn();

jest.mock('@/services/admin/adminContentHealthService', () => ({
  adminContentHealthService: {
    getContentHealth: () => mockGetContentHealth(),
  },
}));

const mockData = {
  summary: {
    missingTranslations: { total: 3, recipes: 1, ingredients: 1, usefulItems: 1 },
    missingImages: { total: 2, recipes: 1, ingredients: 1, usefulItems: 0 },
    missingNutrition: { total: 1, ingredients: 1 },
    unpublished: { total: 2, recipes: 2 },
  },
  issues: [
    {
      id: 'r1',
      entityType: 'recipe' as const,
      name: 'Pasta',
      imageUrl: null,
      isPublished: false,
      stepCount: 3,
      ingredientCount: 5,
      missingEn: true,
      missingEs: false,
      missingImage: true,
      missingNutrition: false,
    },
    {
      id: 'r2',
      entityType: 'recipe' as const,
      name: 'Soup',
      imageUrl: 'https://img.com/soup.jpg',
      isPublished: false,
      stepCount: 2,
      ingredientCount: 4,
      missingEn: false,
      missingEs: false,
      missingImage: false,
      missingNutrition: false,
    },
    {
      id: 'i1',
      entityType: 'ingredient' as const,
      name: 'Tomato',
      imageUrl: null,
      isPublished: null,
      stepCount: null,
      ingredientCount: null,
      missingEn: false,
      missingEs: true,
      missingImage: true,
      missingNutrition: true,
    },
    {
      id: 'u1',
      entityType: 'useful_item' as const,
      name: 'Spatula',
      imageUrl: 'https://img.com/spatula.jpg',
      isPublished: null,
      stepCount: null,
      ingredientCount: null,
      missingEn: true,
      missingEs: false,
      missingImage: false,
      missingNutrition: false,
    },
  ],
};

describe('useContentHealth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetContentHealth.mockResolvedValue(mockData);
  });

  it('loads data on mount', async () => {
    const { result } = renderHook(() => useContentHealth());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
    expect(result.current.filteredIssues).toHaveLength(4);
  });

  it('handles error on load', async () => {
    mockGetContentHealth.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useContentHealth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network error');
    expect(result.current.data).toBeNull();
  });

  it('filters by issue type: translation', async () => {
    const { result } = renderHook(() => useContentHealth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setActiveFilter('translation');
    });

    // r1 (missingEn), i1 (missingEs), u1 (missingEn)
    expect(result.current.filteredIssues).toHaveLength(3);
    expect(result.current.filteredIssues.map((i) => i.id)).toEqual(['r1', 'i1', 'u1']);
  });

  it('filters by issue type: image', async () => {
    const { result } = renderHook(() => useContentHealth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setActiveFilter('image');
    });

    // r1, i1
    expect(result.current.filteredIssues).toHaveLength(2);
    expect(result.current.filteredIssues.map((i) => i.id)).toEqual(['r1', 'i1']);
  });

  it('filters by issue type: nutrition', async () => {
    const { result } = renderHook(() => useContentHealth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setActiveFilter('nutrition');
    });

    // Only i1
    expect(result.current.filteredIssues).toHaveLength(1);
    expect(result.current.filteredIssues[0].id).toBe('i1');
  });

  it('filters by issue type: unpublished', async () => {
    const { result } = renderHook(() => useContentHealth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setActiveFilter('unpublished');
    });

    // r1, r2
    expect(result.current.filteredIssues).toHaveLength(2);
    expect(result.current.filteredIssues.every((i) => i.isPublished === false)).toBe(true);
  });

  it('filters by entity type', async () => {
    const { result } = renderHook(() => useContentHealth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setEntityFilter('ingredient');
    });

    expect(result.current.filteredIssues).toHaveLength(1);
    expect(result.current.filteredIssues[0].id).toBe('i1');
  });

  it('combines issue and entity filters', async () => {
    const { result } = renderHook(() => useContentHealth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setActiveFilter('translation');
      result.current.setEntityFilter('recipe');
    });

    // Only r1 (recipe with missingEn)
    expect(result.current.filteredIssues).toHaveLength(1);
    expect(result.current.filteredIssues[0].id).toBe('r1');
  });

  it('refreshes data when refresh is called', async () => {
    const { result } = renderHook(() => useContentHealth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetContentHealth).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(mockGetContentHealth).toHaveBeenCalledTimes(2);
    });
  });

  it('returns filteredCount matching filteredIssues length', async () => {
    const { result } = renderHook(() => useContentHealth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.filteredCount).toBe(4);

    act(() => {
      result.current.setActiveFilter('nutrition');
    });

    expect(result.current.filteredCount).toBe(1);
  });
});
