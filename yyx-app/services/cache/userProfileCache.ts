import { BaseCache, CacheConfig } from './baseCache';
import { UserProfile } from '@/types/user';

// Cache expiration times for user profiles
const USER_PROFILE_CACHE_CONFIG: CacheConfig = {
  memoryCacheExpiry: __DEV__ 
    ? 30 * 60 * 1000       // 30 minutes in development
    : 6 * 60 * 60 * 1000,  // 6 hours in production
  storageCacheExpiry: __DEV__
    ? 1 * 60 * 60 * 1000   // 1 hour in development
    : 24 * 60 * 60 * 1000, // 24 hours in production
  maxMemoryCacheItems: 2   // Only need to cache current user (maybe 2 for quick switching)
};

class UserProfileCache extends BaseCache<UserProfile> {
  constructor() {
    super('user_profile', USER_PROFILE_CACHE_CONFIG);
  }

  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    return this.getItem(userId);
  }

  async setUserProfile(userId: string, profile: UserProfile): Promise<void> {
    return this.setItem(userId, profile);
  }

  async invalidateUserProfile(userId: string): Promise<void> {
    return this.invalidateItem(userId);
  }
}

export const userProfileCache = new UserProfileCache(); 