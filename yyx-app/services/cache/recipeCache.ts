import { RawRecipe } from '@/types/recipe.api.types';
import { Storage } from '@/utils/storage';

// Cache expiration times - shorter in development
const QUERY_CACHE_EXPIRY = __DEV__ 
  ? 5 * 60 * 1000       // 5 minutes in development
  : 4 * 60 * 60 * 1000; // 4 hours in production

const RECIPE_CACHE_EXPIRY = __DEV__
  ? 15 * 60 * 1000       // 15 minutes in development
  : 24 * 60 * 60 * 1000; // 24 hours in production

const MAX_MEMORY_CACHE_ITEMS = 100; // Limit memory cache size

// Cache entry type with timestamp
type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

// In-memory cache for fast access
const memoryCache: {
  queries: Map<string, CacheEntry<any>>;
  recipes: Map<string, CacheEntry<RawRecipe | null>>;
} = {
  queries: new Map(),
  recipes: new Map()
};

// Track all cache keys we create for easy clearing
const allCacheKeys: Set<string> = new Set();

// Track a key for later cleanup
const trackCacheKey = (key: string) => {
  allCacheKeys.add(key);
  return key;
};

export const recipeCache = {
  // Get recipe list from cache
  async getQueryResult(cacheKey: string) {
    // Check memory cache first (fast)
    const memCached = memoryCache.queries.get(cacheKey);
    if (memCached && Date.now() - memCached.timestamp < QUERY_CACHE_EXPIRY) {
      return memCached.data;
    }
    
    // Try storage cache
    try {
      const storedData = await Storage.getItem(cacheKey);
      
      if (storedData) {
        const parsed = JSON.parse(storedData) as CacheEntry<any>;
        
        if (Date.now() - parsed.timestamp < QUERY_CACHE_EXPIRY) {
          // Refresh memory cache with data from storage
          memoryCache.queries.set(cacheKey, parsed);
          return parsed.data;
        }
      }
    } catch (error) {
      console.warn('Failed to get query result from storage cache', error);
    }
    
    return null;
  },

  // Store recipe list in cache
  async setQueryResult(cacheKey: string, result: any) {
    trackCacheKey(cacheKey);
    
    // Use helper method to store in both caches
    await this.setCacheEntry(memoryCache.queries, cacheKey, result);
    
    // Limit memory cache size
    if (memoryCache.queries.size > MAX_MEMORY_CACHE_ITEMS) {
      const oldest = [...memoryCache.queries.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) memoryCache.queries.delete(oldest[0]);
    }
  },

  // Get individual recipe from cache
  async getRecipe(cacheKey: string): Promise<RawRecipe | null | undefined> {
    // Check memory cache first
    const memCached = memoryCache.recipes.get(cacheKey);
    if (memCached && Date.now() - memCached.timestamp < RECIPE_CACHE_EXPIRY) {
      return memCached.data;
    }
    
    // Try storage cache
    try {
      const storedData = await Storage.getItem(cacheKey);
      
      if (storedData) {
        const parsed = JSON.parse(storedData) as CacheEntry<RawRecipe | null>;
        
        if (Date.now() - parsed.timestamp < RECIPE_CACHE_EXPIRY) {
          // Refresh memory cache
          memoryCache.recipes.set(cacheKey, parsed);
          return parsed.data;
        }
      }
    } catch (error) {
      console.warn('Failed to get recipe from storage cache', error);
    }
    
    return undefined; // undefined means not in cache
  },

  // Store individual recipe in cache
  async setRecipe(cacheKey: string, recipe: RawRecipe | null) {
    trackCacheKey(cacheKey);
    
    // Use the same key for both memory and storage
    await this.setCacheEntry(memoryCache.recipes, cacheKey, recipe);
    
    // Limit memory cache size if needed
    if (memoryCache.recipes.size > MAX_MEMORY_CACHE_ITEMS) {
      const oldest = [...memoryCache.recipes.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) memoryCache.recipes.delete(oldest[0]);
    }
  },

  // Clear all recipe cache
  async clearCache() {
    // Clear memory cache
    memoryCache.queries.clear();
    memoryCache.recipes.clear();
    
    // Clear storage cache using tracked keys
    try {
      const keysToRemove = [...allCacheKeys];
      
      // Remove all keys from storage
      for (const key of keysToRemove) {
        await Storage.removeItem(key);
      }
      
      // Clear our tracking set
      allCacheKeys.clear();
    } catch (error) {
      console.warn('Failed to clear storage cache', error);
    }
  },
  
  // Invalidate specific recipe in cache
  async invalidateRecipe(cacheKey: string) {
    // Remove from memory cache
    memoryCache.recipes.delete(cacheKey);
    
    // Remove from storage
    try {
      await Storage.removeItem(cacheKey);
      allCacheKeys.delete(cacheKey);
    } catch (error) {
      console.warn('Failed to invalidate recipe in storage cache', error);
    }
  },

  // Helper method for setting cache entries
  async setCacheEntry<T>(mapCache: Map<string, CacheEntry<T>>, key: string, data: T) {
    const entry = { data, timestamp: Date.now() };
    mapCache.set(key, entry);
    try {
      await Storage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      console.warn('Failed to store in cache', error);
    }
  }
}; 