import { supabase } from '@/lib/supabase';
import { validateRecipeIsPublished } from '@/services/recipeValidation';

export const RATING_REQUIRES_COMPLETION_ERROR = 'RATING_REQUIRES_COMPLETION';

function isRatingCompletionPolicyError(error: { code?: string; message?: string }): boolean {
    if (error.code === '42501') {
        return true;
    }

    if (!error.message) {
        return false;
    }

    return /row-level security policy.*recipe_ratings/i.test(error.message);
}

/**
 * Service for managing recipe ratings and feedback
 */
export const ratingService = {
    /**
     * Submit or update a rating for a recipe
     * Uses upsert to handle both new ratings and updates
     */
    async submitRating(recipeId: string, rating: number): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('User must be logged in to rate recipes');
        }

        if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
            throw new Error('Rating must be a whole number between 1 and 5');
        }

        // Validate recipe exists and is published
        await validateRecipeIsPublished(recipeId);

        const { error } = await supabase
            .from('recipe_ratings')
            .upsert(
                {
                    user_id: user.id,
                    recipe_id: recipeId,
                    rating,
                },
                {
                    onConflict: 'user_id,recipe_id',
                }
            );

        if (error) {
            if (isRatingCompletionPolicyError(error)) {
                throw new Error(RATING_REQUIRES_COMPLETION_ERROR);
            }

            throw new Error(`Failed to submit rating: ${error.message}`);
        }
    },

    /**
     * Submit feedback for a recipe (stored for admin review)
     */
    async submitFeedback(recipeId: string, feedback: string): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('User must be logged in to submit feedback');
        }

        const trimmedFeedback = feedback.trim();
        if (!trimmedFeedback || trimmedFeedback.length > 2000) {
            throw new Error('Feedback must be between 1 and 2000 characters');
        }

        // Validate recipe exists and is published
        await validateRecipeIsPublished(recipeId);

        const { error } = await supabase
            .from('recipe_feedback')
            .insert({
                user_id: user.id,
                recipe_id: recipeId,
                feedback: trimmedFeedback,
            });

        if (error) {
            throw new Error(`Failed to submit feedback: ${error.message}`);
        }
    },

    /**
     * Get the current user's rating for a recipe
     */
    async getUserRating(recipeId: string): Promise<number | null> {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return null;
        }

        const { data, error } = await supabase
            .from('recipe_ratings')
            .select('rating')
            .eq('user_id', user.id)
            .eq('recipe_id', recipeId)
            .single();

        if (error) {
            // No rating found is not an error
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Failed to get user rating: ${error.message}`);
        }

        return data?.rating ?? null;
    },

    /**
     * Get rating statistics for a recipe
     */
    async getRecipeRatingStats(recipeId: string): Promise<{
        averageRating: number | null;
        ratingCount: number;
    }> {
        const { data, error } = await supabase
            .from('recipes')
            .select('average_rating, rating_count')
            .eq('id', recipeId)
            .single();

        if (error) {
            throw new Error(`Failed to get rating stats: ${error.message}`);
        }

        return {
            averageRating: data?.average_rating ?? null,
            ratingCount: data?.rating_count ?? 0,
        };
    },

    /**
     * Get rating distribution for a recipe (count of each star rating)
     */
    async getRatingDistribution(recipeId: string): Promise<{
        distribution: { [key: number]: number };
        total: number;
    }> {
        const { data, error } = await supabase
            .from('recipe_ratings')
            .select('rating')
            .eq('recipe_id', recipeId);

        if (error) {
            throw new Error(`Failed to get rating distribution: ${error.message}`);
        }

        // Group client-side
        const distribution: { [key: number]: number } = {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
        };

        for (const row of data || []) {
            if (row.rating >= 1 && row.rating <= 5) {
                distribution[row.rating]++;
            }
        }

        const total = (data || []).length;

        return { distribution, total };
    },
};

export default ratingService;
