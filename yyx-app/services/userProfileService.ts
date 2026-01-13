import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types/user';
import { BaseService } from './base/BaseService';
import { OnboardingData } from '@/types/onboarding';
import { userProfileCache } from '@/services/cache';

class UserProfileService extends BaseService {
  async fetchProfile(userId: string) {
    try {
      const cachedProfile = await userProfileCache.getUserProfile(userId);
      if (cachedProfile) {
        return cachedProfile;
      }
      
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      
      const profile = this.transformResponse(data) as UserProfile;
      
      await userProfileCache.setUserProfile(userId, profile);
      
      return profile;
    } catch (error) {
      throw error;
    }
  }

  async updateProfile(userId: string, updates: Partial<UserProfile>) {
    const { otherAllergy, otherDiet, ...profileUpdates } = updates as OnboardingData;

    // First update the profile
    const { error: updateError } = await this.supabase
      .from('user_profiles')
      .update({
        ...this.transformRequest(profileUpdates),
        other_allergy: otherAllergy,
        other_diet: otherDiet
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Then fetch the updated profile
    const { data, error: fetchError } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;
    
    // Get the updated profile and update the cache
    const updatedProfile = this.transformResponse(data) as UserProfile;
    await userProfileCache.setUserProfile(userId, updatedProfile);
    
    return updatedProfile;
  }

  // Clear profile cache
  async clearProfileCache() {
    return userProfileCache.clearCache();
  }
}

const userProfileService = new UserProfileService(supabase);
export default userProfileService;