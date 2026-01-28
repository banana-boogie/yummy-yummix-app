/**
 * MutationQueue Tests
 *
 * Validates namespacing and retry behavior.
 */

let mockStorage: Map<string, string>;

jest.mock('uuid', () => ({
  __esModule: true,
  v4: jest.fn(() => 'mock-uuid'),
}));

jest.mock('@/utils/storage', () => {
  mockStorage = new Map<string, string>();
  return {
    Storage: {
      setItem: jest.fn(async (key: string, value: string) => {
        mockStorage.set(key, value);
      }),
      getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
      removeItem: jest.fn(async (key: string) => {
        mockStorage.delete(key);
      }),
    },
  };
});

import { mutationQueue } from '../mutationQueue';

describe('mutationQueue', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockStorage.clear();
    mutationQueue.setNamespace('user-a');
    await mutationQueue.clear();
  });

  it('isolates queues by namespace', async () => {
    await mutationQueue.enqueue('CHECK_ITEM', { itemId: '1', isChecked: true });
    expect(await mutationQueue.getCount()).toBe(1);

    mutationQueue.setNamespace('user-b');
    expect(await mutationQueue.getCount()).toBe(0);

    mutationQueue.setNamespace('user-a');
    expect(await mutationQueue.getCount()).toBe(1);
  });

  it('drops mutations after three failed attempts', async () => {
    await mutationQueue.enqueue('DELETE_ITEM', { itemId: '1' });

    const failingExecutor = jest.fn(async () => {
      throw new Error('fail');
    });

    await mutationQueue.processAll(failingExecutor);
    await mutationQueue.processAll(failingExecutor);
    await mutationQueue.processAll(failingExecutor);

    expect(await mutationQueue.getCount()).toBe(0);
  });
});
