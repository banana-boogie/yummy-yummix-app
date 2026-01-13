import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import userProfileService from '@/services/userProfileService';
import { UserProfile } from '@/types/user';
import { useAuth } from '@/contexts/AuthContext';
import { userProfileKeys } from '@/lib/queryKeys';

// Re-export for convenience
export { userProfileKeys };

/**
 * Hook to fetch the current user's profile using TanStack Query
 * 
 * Features:
 * - Automatic caching and deduplication
 * - Automatic refetch on stale data
 * - Loading and error states built-in
 */
export function useUserProfileQuery() {
    const { user } = useAuth();

    return useQuery({
        queryKey: userProfileKeys.detail(user?.id ?? ''),
        queryFn: async () => {
            if (!user?.id) throw new Error('No user ID');
            return userProfileService.fetchProfile(user.id);
        },
        enabled: !!user?.id,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Hook to update the user's profile
 * 
 * Features:
 * - Automatic cache update on success
 * - Optimistic updates (optional)
 * - Error handling
 */
export function useUpdateProfileMutation() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (updates: Partial<UserProfile>) => {
            if (!user?.id) throw new Error('No user ID');
            return userProfileService.updateProfile(user.id, updates);
        },
        onSuccess: (updatedProfile) => {
            // Update the cache with the new profile data
            if (user?.id) {
                queryClient.setQueryData(
                    userProfileKeys.detail(user.id),
                    updatedProfile
                );
            }
        },
        onError: (error) => {
            console.error('Failed to update profile:', error);
        },
    });
}

/**
 * Invalidate the user profile cache
 * Useful for forcing a refetch after external changes
 */
export function useInvalidateUserProfile() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return () => {
        if (user?.id) {
            queryClient.invalidateQueries({
                queryKey: userProfileKeys.detail(user.id),
            });
        }
    };
}
