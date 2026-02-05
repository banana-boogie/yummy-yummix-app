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
    if (authStateCallback) {
      authStateCallback('SIGNED_OUT', null);
    }

    // Flush should have nothing to send
    await eventService.flush();

    expect(insertMock).not.toHaveBeenCalled();
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
