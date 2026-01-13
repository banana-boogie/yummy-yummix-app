// Define types for the cache system

export type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

export type Cache<T> = {
  entries: Record<string, CacheEntry<T>>;
  keysByRecency: string[];
};

export type CacheOptions = {
  expirationTime: number; // in milliseconds
  maxSize: number;
}; 