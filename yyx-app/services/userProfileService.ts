import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types/user';
import { BaseService } from './base/BaseService';
import { OnboardingData } from '@/types/onboarding';

class UserProfileService extends BaseService {
  async fetchProfile(userId: string) {
    // No service-layer caching - TanStack Query handles caching
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return this.transformResponse(data) as UserProfile;
  }

  async updateProfile(userId: string, updates: Partial<UserProfile>) {
    const { otherAllergy, otherDiet, cuisinePreferences, ...profileUpdates } = updates as OnboardingData;

    const updateData = {
      ...this.transformRequest(profileUpdates),
      other_allergy: otherAllergy,
      other_diet: otherDiet,
      cuisine_preferences: cuisinePreferences, // Use snake_case for database column
    };

    // First, check if profile exists
    const { data: existingProfile } = await this.supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    let data, error;

    if (!existingProfile) {
      // Profile doesn't exist - this indicates a stale session or missing profile
      // The user needs to re-authenticate
      console.warn('Profile does not exist for user:', userId);
      throw new Error('PROFILE_NOT_FOUND');
    }

    // Profile exists, perform update
    const result = await this.supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', userId)
      .select('*')
      .single();

    data = result.data;
    error = result.error;

    if (error) {
      console.error('Update profile error:', {
        error,
        userId,
        updates: Object.keys(updates),
        code: error.code
      });
      throw error;
    }

    if (!data) {
      throw new Error('No data returned from profile update');
    }

    // Transform response - TanStack Query handles caching
    return this.transformResponse(data) as UserProfile;
  }
}

const userProfileService = new UserProfileService(supabase);
export default userProfileService;