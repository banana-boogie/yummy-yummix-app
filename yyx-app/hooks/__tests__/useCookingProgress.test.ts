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

function createSelectBuilder(response: { data: any; error: any }) {
  const builder: any = {
    eq: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    maybeSingle: jest.fn(async () => response),
  };

  return {
    builder,
    table: {
      select: jest.fn(() => builder),
    },
  };
}

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

  it('returns false and does not call RPC when user is not authenticated', async () => {
    mockAuthUser = null;
    const { result } = renderHook(() => useCookingProgress());

    let ok = true;
    await act(async () => {
      ok = await result.current.upsertProgress({
        recipeId: 'recipe-456',
        recipeType: 'database',
        recipeName: 'Tortilla Soup',
        currentStep: 1,
        totalSteps: 5,
      });
    });

    expect(ok).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('getResumableSession applies freshness predicate and maps session data', async () => {
    const fresh = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { builder, table } = createSelectBuilder({
      data: {
        id: 'session-1',
        recipe_id: 'recipe-1',
        recipe_type: 'custom',
        recipe_name: 'Weeknight Tacos',
        current_step: 3,
        total_steps: 8,
        status: 'active',
        last_active_at: fresh,
      },
      error: null,
    });
    mockFrom.mockReturnValue(table);

    const { result } = renderHook(() => useCookingProgress());

    let session: any;
    await act(async () => {
      session = await result.current.getResumableSession();
    });

    expect(builder.gte).toHaveBeenCalledWith('last_active_at', expect.any(String));
    expect(session).toEqual({
      id: 'session-1',
      recipeId: 'recipe-1',
      recipeType: 'custom',
      recipeName: 'Weeknight Tacos',
      currentStep: 3,
      totalSteps: 8,
      status: 'active',
    });
  });

  it('getResumableSession returns null for stale sessions (defensive check)', async () => {
    const stale = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
    const { table } = createSelectBuilder({
      data: {
        id: 'session-2',
        recipe_id: 'recipe-2',
        recipe_type: 'database',
        recipe_name: 'Old Recipe',
        current_step: 2,
        total_steps: 5,
        status: 'active',
        last_active_at: stale,
      },
      error: null,
    });
    mockFrom.mockReturnValue(table);

    const { result } = renderHook(() => useCookingProgress());

    let session: any;
    await act(async () => {
      session = await result.current.getResumableSession();
    });

    expect(session).toBeNull();
  });
});
