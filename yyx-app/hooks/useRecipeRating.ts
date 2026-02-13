import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ratingService } from '@/services/ratingService';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Query keys for rating-related queries
 */
export const ratingKeys = {
    all: ['ratings'] as const,
    userRating: (recipeId: string) => [...ratingKeys.all, 'user', recipeId] as const,
    stats: (recipeId: string) => [...ratingKeys.all, 'stats', recipeId] as const,
    distribution: (recipeId: string) => [...ratingKeys.all, 'distribution', recipeId] as const,
};

/**
 * Hook for managing recipe ratings
 */
export function useRecipeRating(recipeId: string) {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Fetch user's existing rating
    const {
        data: userRating,
        isLoading: isLoadingRating,
    } = useQuery({
        queryKey: ratingKeys.userRating(recipeId),
        queryFn: () => ratingService.getUserRating(recipeId),
        enabled: !!user && !!recipeId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // Fetch rating distribution
    const {
        data: ratingDistribution,
        isLoading: isLoadingDistribution,
    } = useQuery({
        queryKey: ratingKeys.distribution(recipeId),
        queryFn: () => ratingService.getRatingDistribution(recipeId),
        enabled: !!recipeId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // Submit rating mutation
    const submitRatingMutation = useMutation({
        mutationFn: async (rating: number) => {
            await ratingService.submitRating(recipeId, rating);
            return rating;
        },
        onMutate: async (newRating) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ratingKeys.userRating(recipeId) });

            // Snapshot previous value
            const previousRating = queryClient.getQueryData(ratingKeys.userRating(recipeId));

            // Optimistically update
            queryClient.setQueryData(ratingKeys.userRating(recipeId), newRating);

            return { previousRating };
        },
        onError: (_err, _newRating, context) => {
            // Rollback on error
            if (context?.previousRating !== undefined) {
                queryClient.setQueryData(ratingKeys.userRating(recipeId), context.previousRating);
            }
        },
        onSettled: () => {
            // Invalidate to refetch
            queryClient.invalidateQueries({ queryKey: ratingKeys.userRating(recipeId) });
            queryClient.invalidateQueries({ queryKey: ratingKeys.stats(recipeId) });
            queryClient.invalidateQueries({ queryKey: ratingKeys.distribution(recipeId) });
            // Also invalidate recipe queries to refresh the cached rating stats
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
        },
    });

    // Submit feedback mutation
    const submitFeedbackMutation = useMutation({
        mutationFn: (feedback: string) => ratingService.submitFeedback(recipeId, feedback),
    });

    return {
        userRating: userRating ?? null,
        isLoadingRating,
        isLoggedIn: !!user,
        submitRating: submitRatingMutation.mutate,
        submitRatingAsync: submitRatingMutation.mutateAsync,
        isSubmittingRating: submitRatingMutation.isPending,
        ratingError: submitRatingMutation.error,
        submitFeedback: submitFeedbackMutation.mutate,
        submitFeedbackAsync: submitFeedbackMutation.mutateAsync,
        isSubmittingFeedback: submitFeedbackMutation.isPending,
        feedbackError: submitFeedbackMutation.error,
        // Rating distribution
        ratingDistribution: ratingDistribution?.distribution ?? null,
        totalRatings: ratingDistribution?.total ?? 0,
        isLoadingDistribution,
    };
}
