import { supabase } from '@/lib/supabase';

/**
 * Service for managing recipe ratings and feedback
 */
export const ratingService = {
    /**
     * Validate that a recipe exists and is published
     */
    async validateRecipe(recipeId: string): Promise<void> {
        const { data, error } = await supabase
            .from('recipes')
            .select('id, status')
            .eq('id', recipeId)
            .single();

        if (error || !data) {
            throw new Error('Recipe not found');
        }

        if (data.status !== 'published') {
            throw new Error('Recipe is not available for rating');
        }
    },

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
        await this.validateRecipe(recipeId);

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
        await this.validateRecipe(recipeId);

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
        // Validate recipe exists and is published
        await this.validateRecipe(recipeId);

        // Initialize distribution with zeros
        const distribution: { [key: number]: number } = {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
        };

        const ratingBuckets = [1, 2, 3, 4, 5];
        const results = await Promise.all(
            ratingBuckets.map((rating) =>
                supabase
                    .from('recipe_ratings')
                    .select('*', { count: 'exact', head: true })
                    .eq('recipe_id', recipeId)
                    .eq('rating', rating)
            )
        );

        results.forEach((result, index) => {
            if (result.error) {
                throw new Error(`Failed to get rating distribution: ${result.error.message}`);
            }
            distribution[ratingBuckets[index]] = result.count ?? 0;
        });

        const total = ratingBuckets.reduce((sum, rating) => sum + distribution[rating], 0);

        return { distribution, total };
    },
};

export default ratingService;
