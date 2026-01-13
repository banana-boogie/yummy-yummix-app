import React, { createContext, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserProfile } from '@/types/user';
import { useAuth } from '@/contexts/AuthContext';
import {
  useUserProfileQuery,
  useUpdateProfileMutation,
  userProfileKeys
} from '@/hooks/useUserProfileQuery';

type UserProfileContextType = {
  userProfile: UserProfile | null;
  loading: boolean;
  error: Error | null;
  isAdmin: boolean;
  fetchUserProfile: () => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>;
};

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Use TanStack Query for data fetching
  const {
    data: userProfile,
    isLoading,
    error: queryError,
    refetch
  } = useUserProfileQuery();

  // Use TanStack Query mutation for updates
  const updateMutation = useUpdateProfileMutation();

  // Wrapper to maintain backward compatibility with existing API
  const fetchUserProfile = async () => {
    if (!user?.id) return;

    // Invalidate and refetch to get fresh data
    await queryClient.invalidateQueries({
      queryKey: userProfileKeys.detail(user.id),
    });
    await refetch();
  };

  // Wrapper to maintain backward compatibility with existing API
  const updateUserProfile = async (updates: Partial<UserProfile>): Promise<UserProfile> => {
    const result = await updateMutation.mutateAsync(updates);
    return result;
  };

  // Compute isAdmin from profile
  const isAdmin = !!userProfile?.isAdmin;

  // Convert query error to Error type for backward compatibility
  const error = queryError instanceof Error ? queryError : null;

  return (
    <UserProfileContext.Provider
      value={{
        userProfile: userProfile ?? null,
        loading: isLoading,
        error,
        isAdmin,
        updateUserProfile,
        fetchUserProfile
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
};
