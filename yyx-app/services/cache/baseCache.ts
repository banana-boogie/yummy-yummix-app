import { Storage } from '@/utils/storage';

// Configuration types
export type CacheConfig = {
  memoryCacheExpiry: number;
  storageCacheExpiry: number;
  maxMemoryCacheItems: number;
};

// Cache entry type with timestamp
export type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

export class BaseCache<T> {
  private memoryCache: Map<string, CacheEntry<T>>;
  private config: CacheConfig;
  private cachePrefix: string;
  private registryKey: string;

  constructor(cachePrefix: string, config: CacheConfig) {
    this.memoryCache = new Map();
    this.config = config;
    this.cachePrefix = cachePrefix;
    this.registryKey = `${cachePrefix}:registry`;
  }
  
  // Load cache registry from persistent storage
  private async getRegistryKeys(): Promise<string[]> {
    try {
      const registry = await Storage.getItem(this.registryKey);
      if (registry) {
        return JSON.parse(registry) as string[];
      }
    } catch (error) {
      console.warn(`Failed to load cache registry for ${this.cachePrefix}`, error);
    }
    return [];
  }
  
  // Save a key to registry
  private async addKeyToRegistry(key: string): Promise<void> {
    try {
      const keys = await this.getRegistryKeys();
      if (!keys.includes(key)) {
        keys.push(key);
        await Storage.setItem(this.registryKey, JSON.stringify(keys));
      }
    } catch (error) {
      console.warn(`Failed to save key to registry: ${key}`, error);
    }
  }
  
  // Remove a key from registry
  private async removeKeyFromRegistry(key: string): Promise<void> {
    try {
      const keys = await this.getRegistryKeys();
      const filteredKeys = keys.filter(k => k !== key);
      
      if (keys.length !== filteredKeys.length) {
        await Storage.setItem(this.registryKey, JSON.stringify(filteredKeys));
      }
    } catch (error) {
      console.warn(`Failed to remove key from registry: ${key}`, error);
    }
  }

  // Track a key for later cleanup
  protected async trackCacheKey(key: string): Promise<string> {
    const prefixedKey = `${this.cachePrefix}:${key}`;
    await this.addKeyToRegistry(prefixedKey);
    return prefixedKey;
  }

  // Get item from cache
  async getItem(key: string): Promise<T | undefined> {
    const cacheKey = `${this.cachePrefix}:${key}`;
    
    // Check memory cache first (fast)
    const memCached = this.memoryCache.get(cacheKey);
    if (memCached && Date.now() - memCached.timestamp < this.config.memoryCacheExpiry) {
      return memCached.data;
    }
    
    // Try storage cache
    try {
      const storedData = await Storage.getItem(cacheKey);
      
      if (storedData) {
        const parsed = JSON.parse(storedData) as CacheEntry<T>;
        
        if (Date.now() - parsed.timestamp < this.config.storageCacheExpiry) {
          // Refresh memory cache with data from storage
          this.memoryCache.set(cacheKey, parsed);
          return parsed.data;
        }
      }
    } catch (error) {
      console.warn(`Failed to get item from storage cache: ${cacheKey}`, error);
    }
    
    return undefined;
  }

  // Get the timestamp of when an item was cached
  async getItemTimestamp(key: string): Promise<number | undefined> {
    const cacheKey = `${this.cachePrefix}:${key}`;
    
    // Check memory cache first
    const memCached = this.memoryCache.get(cacheKey);
    if (memCached) {
      return memCached.timestamp;
    }
    
    // Try storage cache
    try {
      const storedData = await Storage.getItem(cacheKey);
      
      if (storedData) {
        const parsed = JSON.parse(storedData) as CacheEntry<T>;
        return parsed.timestamp;
      }
    } catch (error) {
      console.warn(`Failed to get timestamp from cache: ${cacheKey}`, error);
    }
    
    return undefined;
  }

  // Check if an item is fresh based on a custom max age
  async isItemFresh(key: string, maxAgeMs: number): Promise<boolean> {
    const timestamp = await this.getItemTimestamp(key);
    if (!timestamp) return false;
    
    return (Date.now() - timestamp) < maxAgeMs;
  }

  // Store item in cache
  async setItem(key: string, data: T): Promise<void> {
    const cacheKey = await this.trackCacheKey(key);
    
    // Create cache entry
    const entry: CacheEntry<T> = { 
      data, 
      timestamp: Date.now() 
    };
    
    // Store in memory cache
    this.memoryCache.set(cacheKey, entry);
    
    // Store in persistent storage
    try {
      await Storage.setItem(cacheKey, JSON.stringify(entry));
    } catch (error) {
      console.warn(`Failed to store in cache: ${cacheKey}`, error);
    }
    
    // Limit memory cache size
    if (this.memoryCache.size > this.config.maxMemoryCacheItems) {
      const oldest = [...this.memoryCache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) this.memoryCache.delete(oldest[0]);
    }
  }

  // Clear all cache
  async clearCache(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();
    
    // Clear storage cache using registry keys
    try {
      const keysToRemove = await this.getRegistryKeys();
      
      // Remove all keys from storage
      for (const key of keysToRemove) {
        await Storage.removeItem(key);
      }
      
      // Clear registry
      await Storage.removeItem(this.registryKey);
    } catch (error) {
      console.warn('Failed to clear storage cache', error);
    }
  }
  
  // Invalidate specific item in cache
  async invalidateItem(key: string): Promise<void> {
    const cacheKey = `${this.cachePrefix}:${key}`;
    
    // Remove from memory cache
    this.memoryCache.delete(cacheKey);
    
    // Remove from storage
    try {
      await Storage.removeItem(cacheKey);
      await this.removeKeyFromRegistry(cacheKey);
    } catch (error) {
      console.warn(`Failed to invalidate item in storage cache: ${cacheKey}`, error);
    }
  }
} 