/**
 * eventService Tests
 *
 * Covers:
 * - Re-queuing events when insert fails
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
        addEventListener: jest.fn(),
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
});
