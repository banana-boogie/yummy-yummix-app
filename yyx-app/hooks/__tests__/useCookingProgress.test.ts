import { act, renderHook } from '@testing-library/react-native';
import { useCookingProgress } from '../useCookingProgress';

const mockRpc = jest.fn();
const mockFrom = jest.fn();

let mockAuthUser: { id: string } | null = { id: 'user-123' };

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: (...args: any[]) => mockFrom(...args),
  },
}));

describe('useCookingProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = { id: 'user-123' };
    mockRpc.mockResolvedValue({ error: null });
  });

  it('calls upsert_cooking_session_progress RPC with expected payload', async () => {
    const { result } = renderHook(() => useCookingProgress());

    await act(async () => {
      await result.current.upsertProgress({
        recipeId: 'recipe-456',
        recipeType: 'custom',
        recipeName: 'Spicy Tacos',
        currentStep: 2,
        totalSteps: 7,
      });
    });

    expect(mockRpc).toHaveBeenCalledWith('upsert_cooking_session_progress', {
      p_recipe_id: 'recipe-456',
      p_recipe_type: 'custom',
      p_recipe_name: 'Spicy Tacos',
      p_current_step: 2,
      p_total_steps: 7,
    });
  });

  it('does not call RPC when user is not authenticated', async () => {
    mockAuthUser = null;
    const { result } = renderHook(() => useCookingProgress());

    await act(async () => {
      await result.current.upsertProgress({
        recipeId: 'recipe-456',
        recipeType: 'database',
        recipeName: 'Tortilla Soup',
        currentStep: 1,
        totalSteps: 5,
      });
    });

    expect(mockRpc).not.toHaveBeenCalled();
  });
});
