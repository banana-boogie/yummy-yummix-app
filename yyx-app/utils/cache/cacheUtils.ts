// Generic cache implementation
import { Cache, CacheEntry, CacheOptions } from './types';

// Default cache options
export const DEFAULT_CACHE_OPTIONS: CacheOptions = {
  expirationTime: 30 * 60 * 1000, // 30 minutes
  maxSize: 50,
};

/**
 * Creates a new cache instance with the specified options
 */
export function createCache<T>(): Cache<T> {
  return {
    entries: {},
    keysByRecency: [],
  };
}

/**
 * Checks if a cache entry is still valid (not expired)
 */
export function isCacheEntryValid<T>(
  entry: CacheEntry<T>, 
  options: CacheOptions = DEFAULT_CACHE_OPTIONS
): boolean {
  const now = Date.now();
  return now - entry.timestamp < options.expirationTime;
}

/**
 * Updates the recency order of keys in the cache
 */
export function updateCacheRecency<T>(
  cache: Cache<T>, 
  key: string
): void {
  // Remove the key if it already exists
  cache.keysByRecency = cache.keysByRecency.filter(k => k !== key);
  // Add the key to the end (most recent)
  cache.keysByRecency.push(key);
}

/**
 * Enforces the cache size limit by removing least recently used entries
 */
export function enforceCacheSizeLimit<T>(
  cache: Cache<T>, 
  options: CacheOptions = DEFAULT_CACHE_OPTIONS
): void {
  while (cache.keysByRecency.length > options.maxSize) {
    const oldestKey = cache.keysByRecency.shift();
    if (oldestKey && cache.entries[oldestKey]) {
      delete cache.entries[oldestKey];
    }
  }
}

/**
 * Gets an item from the cache
 * Returns null if the item doesn't exist or is expired
 */
export function getCacheItem<T>(
  cache: Cache<T>, 
  key: string, 
  options: CacheOptions = DEFAULT_CACHE_OPTIONS
): T | null {
  const entry = cache.entries[key];
  
  if (!entry) {
    return null;
  }
  
  if (!isCacheEntryValid(entry, options)) {
    // Remove expired entry
    delete cache.entries[key];
    cache.keysByRecency = cache.keysByRecency.filter(k => k !== key);
    return null;
  }
  
  // Update recency for accessed item
  updateCacheRecency(cache, key);
  return entry.data;
}

/**
 * Sets an item in the cache
 */
export function setCacheItem<T>(
  cache: Cache<T>, 
  key: string, 
  data: T, 
  options: CacheOptions = DEFAULT_CACHE_OPTIONS
): void {
  cache.entries[key] = {
    data,
    timestamp: Date.now(),
  };
  
  updateCacheRecency(cache, key);
  enforceCacheSizeLimit(cache, options);
}

/**
 * Clears specific items from the cache that match a prefix
 */
export function clearCacheItems<T>(
  cache: Cache<T>, 
  keyPrefix: string
): void {
  Object.keys(cache.entries).forEach(key => {
    if (key.startsWith(keyPrefix)) {
      delete cache.entries[key];
      cache.keysByRecency = cache.keysByRecency.filter(k => k !== key);
    }
  });
}

/**
 * Clears all items from the cache
 */
export function clearCache<T>(cache: Cache<T>): void {
  cache.entries = {};
  cache.keysByRecency = [];
} 