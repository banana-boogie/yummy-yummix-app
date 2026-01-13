// Query keys for user profile
// Separated into its own file to avoid circular dependencies
export const userProfileKeys = {
    all: ['userProfile'] as const,
    detail: (userId: string) => [...userProfileKeys.all, userId] as const,
};
