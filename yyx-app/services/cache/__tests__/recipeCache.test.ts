/**
 * recipeCache Tests
 *
 * Tests for recipe caching covering:
 * - Query result caching
 * - Cache hit/miss
 * - TTL/expiration
 * - Cache clearing
 * - Cache invalidation
 */

import { recipeCache } from '../recipeCache';
import { Storage } from '@/utils/storage';
import { recipeFactory } from '@/test/factories';

// Mock Storage
jest.mock('@/utils/storage', () => ({
  Storage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

describe('recipeCache', () => {
  const mockRecipe = recipeFactory.create();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (Storage.getItem as jest.Mock).mockResolvedValue(null);
    (Storage.setItem as jest.Mock).mockResolvedValue(undefined);
    (Storage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================================
  // QUERY RESULT CACHE TESTS
  // ============================================================

  describe('query result caching', () => {
    it('returns null for cache miss', async () => {
      const result = await recipeCache.getQueryResult('nonexistent-key');
      expect(result).toBeNull();
    });

    it('stores and retrieves query results', async () => {
      const cacheKey = 'recipes-published-en';
      const data = { recipes: [mockRecipe], hasMore: false };

      await recipeCache.setQueryResult(cacheKey, data);
      const result = await recipeCache.getQueryResult(cacheKey);

      expect(result).toEqual(data);
    });

    it('expires query cache after TTL', async () => {
      const cacheKey = 'recipes-test';
      const data = { recipes: [mockRecipe] };

      await recipeCache.setQueryResult(cacheKey, data);

      // Advance time beyond cache expiry (5 minutes in dev)
      jest.advanceTimersByTime(6 * 60 * 1000); // 6 minutes

      const result = await recipeCache.getQueryResult(cacheKey);
      expect(result).toBeNull();
    });

    it('uses memory cache before storage', async () => {
      const cacheKey = 'memory-test';
      const data = { recipes: [mockRecipe] };

      await recipeCache.setQueryResult(cacheKey, data);

      // Clear storage mock to ensure memory cache is used
      (Storage.getItem as jest.Mock).mockClear();

      const result = await recipeCache.getQueryResult(cacheKey);

      expect(result).toEqual(data);
      expect(Storage.getItem).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // SINGLE RECIPE CACHE TESTS
  // ============================================================

  describe('single recipe caching', () => {
    it('returns undefined for cache miss on single recipe', async () => {
      const result = await recipeCache.getRecipe('nonexistent-key');
      expect(result).toBeUndefined();
    });

    it('stores and retrieves single recipes', async () => {
      const cacheKey = `recipe:${mockRecipe.id}:en`;

      await recipeCache.setRecipe(cacheKey, mockRecipe as any);
      const result = await recipeCache.getRecipe(cacheKey);

      expect(result).toEqual(mockRecipe);
    });
  });

  // ============================================================
  // CACHE CLEARING TESTS
  // ============================================================

  describe('cache clearing', () => {
    it('clears all caches', async () => {
      const cacheKey = 'recipes-key';
      await recipeCache.setQueryResult(cacheKey, { recipes: [mockRecipe] });

      await recipeCache.clearCache();

      const result = await recipeCache.getQueryResult(cacheKey);
      expect(result).toBeNull();
    });

    it('invalidates specific recipe cache', async () => {
      const cacheKey = `recipe:${mockRecipe.id}:en`;

      await recipeCache.setRecipe(cacheKey, mockRecipe as any);
      await recipeCache.invalidateRecipe(cacheKey);

      const result = await recipeCache.getRecipe(cacheKey);
      expect(result).toBeUndefined();
    });
  });

  // ============================================================
  // STORAGE PERSISTENCE TESTS
  // ============================================================

  describe('storage persistence', () => {
    it('persists cache to storage', async () => {
      const cacheKey = 'persist-test';
      const data = { recipes: [mockRecipe] };

      await recipeCache.setQueryResult(cacheKey, data);

      expect(Storage.setItem).toHaveBeenCalled();
    });

    it('reads from storage when memory cache is empty', async () => {
      const cacheKey = 'storage-test';
      const data = { recipes: [mockRecipe] };
      const storedData = JSON.stringify({ data, timestamp: Date.now() });

      (Storage.getItem as jest.Mock).mockResolvedValueOnce(storedData);

      const result = await recipeCache.getQueryResult(cacheKey);

      expect(Storage.getItem).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(data);
    });
  });
});
