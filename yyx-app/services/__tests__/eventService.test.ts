/**
 * eventService Tests
 *
 * Covers:
 * - Re-queuing events when insert fails
 * - Empty search queries are ignored
 * - Batch size triggers automatic flush
 * - Sign-out clears queue
 * - destroy() cleans up subscriptions
 *
 * FOR AI AGENTS:
 * - This test mocks Supabase before importing the service
 * - Uses fake timers to avoid lingering intervals
 */

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('eventService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('requeues events when insert fails', async () => {
    const insertMock = jest
      .fn()
      .mockResolvedValueOnce({ error: new Error('Insert failed') })
      .mockResolvedValueOnce({ error: null });

    jest.doMock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
          onAuthStateChange: jest.fn(() => ({
            data: { subscription: { unsubscribe: jest.fn() } },
          })),
        },
        from: jest.fn(() => ({
          insert: insertMock,
        })),
      },
    }));

    jest.doMock('react-native', () => ({
      AppState: {
        addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      },
      Platform: { OS: 'ios' },
    }));

    // Use require here to avoid dynamic import VM module requirements in Jest.
    const { eventService } = require('../eventService');

    await flushPromises();

    eventService.logRecipeView('recipe-1', 'Recipe 1');

    await eventService.flush();
    await eventService.flush();

    expect(insertMock).toHaveBeenCalledTimes(2);
    const firstCallRows = insertMock.mock.calls[0][0];
    const secondCallRows = insertMock.mock.calls[1][0];

    expect(firstCallRows).toEqual(secondCallRows);
    expect(firstCallRows[0]).toEqual(
      expect.objectContaining({
        user_id: 'user-1',
        event_type: 'view_recipe',
      })
    );
  });

  it('ignores empty search queries', async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null });

    jest.doMock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
          onAuthStateChange: jest.fn(() => ({
            data: { subscription: { unsubscribe: jest.fn() } },
          })),
        },
        from: jest.fn(() => ({
          insert: insertMock,
        })),
      },
    }));

    jest.doMock('react-native', () => ({
      AppState: {
        addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      },
      Platform: { OS: 'ios' },
    }));

    const { eventService } = require('../eventService');

    await flushPromises();

    // These should all be ignored
    eventService.logSearch('');
    eventService.logSearch('   ');
    eventService.logSearch('\t\n');

    await eventService.flush();

    expect(insertMock).not.toHaveBeenCalled();
  });

  it('queues recipe_generate events with success payload', async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null });

    jest.doMock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
          onAuthStateChange: jest.fn(() => ({
            data: { subscription: { unsubscribe: jest.fn() } },
          })),
        },
        from: jest.fn(() => ({
          insert: insertMock,
        })),
      },
    }));

    jest.doMock('react-native', () => ({
      AppState: {
        addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      },
      Platform: { OS: 'ios' },
    }));

    const { eventService } = require('../eventService');
    await flushPromises();

    eventService.logRecipeGenerate('Pasta Roja', true, 1823);
    await eventService.flush();

    expect(insertMock).toHaveBeenCalledTimes(1);
    const [row] = insertMock.mock.calls[0][0];
    expect(row.event_type).toBe('recipe_generate');
    expect(row.payload).toEqual(
      expect.objectContaining({
        recipe_name: 'Pasta Roja',
        success: true,
        duration_ms: 1823,
      })
    );
  });

  it('auto-flushes when batch size is reached', async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null });

    jest.doMock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
          onAuthStateChange: jest.fn(() => ({
            data: { subscription: { unsubscribe: jest.fn() } },
          })),
        },
        from: jest.fn(() => ({
          insert: insertMock,
        })),
      },
    }));

    jest.doMock('react-native', () => ({
      AppState: {
        addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      },
      Platform: { OS: 'ios' },
    }));

    const { eventService } = require('../eventService');

    await flushPromises();

    // BATCH_SIZE is 10, so logging 10 events should trigger a flush
    for (let i = 0; i < 10; i++) {
      eventService.logRecipeView(`recipe-${i}`, `Recipe ${i}`);
    }

    // Allow flush to complete
    await flushPromises();

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0]).toHaveLength(10);
  });

  it('clears queue on sign out', async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null });
    let authStateCallback: ((event: string, session: { user?: { id: string } } | null) => void) | null = null;

    jest.doMock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
          onAuthStateChange: jest.fn((callback) => {
            authStateCallback = callback;
            return { data: { subscription: { unsubscribe: jest.fn() } } };
          }),
        },
        from: jest.fn(() => ({
          insert: insertMock,
        })),
      },
    }));

    jest.doMock('react-native', () => ({
      AppState: {
        addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      },
      Platform: { OS: 'ios' },
    }));

    const { eventService } = require('../eventService');

    await flushPromises();

    // Queue some events
    eventService.logRecipeView('recipe-1', 'Recipe 1');
    eventService.logRecipeView('recipe-2', 'Recipe 2');

    // Simulate sign out
    const signOutHandler = authStateCallback;
    if (typeof signOutHandler === 'function') {
      signOutHandler('SIGNED_OUT', null);
    }

    // Flush should have nothing to send
    await eventService.flush();

    expect(insertMock).not.toHaveBeenCalled();
  });

  it('trackEvent queues typed planner events with camelCase payloads', async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null });

    jest.doMock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
          onAuthStateChange: jest.fn(() => ({
            data: { subscription: { unsubscribe: jest.fn() } },
          })),
        },
        from: jest.fn(() => ({
          insert: insertMock,
        })),
      },
    }));

    jest.doMock('react-native', () => ({
      AppState: {
        addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      },
      Platform: { OS: 'ios' },
    }));

    const { eventService } = require('../eventService');
    await flushPromises();

    eventService.trackEvent(
      {
        name: 'meal_plan_approved',
        payload: {
          mealPlanId: 'plan-1',
          weekStart: '2026-04-13',
          requestedDayIndexes: [0, 1, 2],
          requestedMealTypes: ['dinner'],
          generatedSlotCount: 3,
          approvalDurationMs: 12000,
          isFirstWeekPlan: true,
          shoppingListId: null,
        },
      },
      { locale: 'es-MX', sourceSurface: 'week' },
    );

    await eventService.flush();

    expect(insertMock).toHaveBeenCalledTimes(1);
    const [row] = insertMock.mock.calls[0][0];
    expect(row.event_type).toBe('meal_plan_approved');
    expect(row.payload).toEqual(
      expect.objectContaining({
        mealPlanId: 'plan-1',
        weekStart: '2026-04-13',
        generatedSlotCount: 3,
        isFirstWeekPlan: true,
      })
    );
    // Envelope is flattened into payload._envelope until a dedicated schema
    // migration adds top-level columns (see eventService.flush TODO).
    expect(row.payload._envelope).toEqual({
      locale: 'es-MX',
      sourceSurface: 'week',
      appPlatform: 'ios',
    });
  });

  // Type-only regression tests: these never execute, but failing them means
  // the compiler accepted a mismatched (name, payload) pair. Locks the
  // strictness of the discriminated `AnalyticsEvent` union.
  it.skip('type-level: rejects mismatched event name / payload pairs', () => {
    // Import types lazily here so the test body type-checks against the real
    // service exports without affecting the module mock above.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { eventService } = require('../eventService') as typeof import('../eventService');

    // 1) Planner event name paired with a legacy recipe-shaped payload.
    //    `meal_plan_approved` requires MealPlanApprovedPayload (mealPlanId,
    //    weekStart, ...) — a payload missing those required fields must be
    //    rejected.
    const badPayload1 = { recipe_id: 'r-1', recipe_name: 'R' };
    eventService.trackEvent(
      // @ts-expect-error — 'meal_plan_approved' requires MealPlanApprovedPayload
      { name: 'meal_plan_approved', payload: badPayload1 },
      { locale: 'en', sourceSurface: 'week' },
    );

    // 2) Legacy event name paired with a planner payload.
    //    `view_recipe` requires LegacyRecipePayload (recipe_id/recipe_name) —
    //    a planner payload must be rejected.
    const badPayload2 = {
      mealPlanId: 'plan-1',
      weekStart: '2026-04-13',
      requestedDayIndexes: [] as number[],
      requestedMealTypes: [] as string[],
      generatedSlotCount: 0,
    };
    eventService.trackEvent(
      // @ts-expect-error — 'view_recipe' requires LegacyRecipePayload
      { name: 'view_recipe', payload: badPayload2 },
      { locale: 'en', sourceSurface: 'week' },
    );
  });

  it('cleans up subscriptions on destroy', async () => {
    const removeListenerMock = jest.fn();
    const insertMock = jest.fn().mockResolvedValue({ error: null });

    jest.doMock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
          onAuthStateChange: jest.fn(() => ({
            data: { subscription: { unsubscribe: jest.fn() } },
          })),
        },
        from: jest.fn(() => ({
          insert: insertMock,
        })),
      },
    }));

    jest.doMock('react-native', () => ({
      AppState: {
        addEventListener: jest.fn(() => ({ remove: removeListenerMock })),
      },
      Platform: { OS: 'ios' },
    }));

    const { eventService } = require('../eventService');

    await flushPromises();

    eventService.destroy();

    expect(removeListenerMock).toHaveBeenCalled();
  });
});
