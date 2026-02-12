import { supabase } from '@/lib/supabase';
import { validateRecipeIsPublished } from '@/services/recipeValidation';

/**
 * Service for tracking recipe completions
 */
export const recipeCompletionService = {
    /**
     * Record a recipe completion
     * - Inserts append-only completion event rows
     */
    async recordCompletion(recipeId: string): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            // Silently skip for non-logged-in users
            return;
        }

        // Validate recipe exists and is published
        await validateRecipeIsPublished(recipeId);

        const { error: insertError } = await supabase
            .from('recipe_completions')
            .insert({
                user_id: user.id,
                recipe_id: recipeId,
                completed_at: new Date().toISOString(),
            });

        if (insertError) {
            throw new Error('Failed to record recipe completion. Please try again.');
        }
    },

    /**
     * Check if user has completed a recipe
     */
    async hasCompletedRecipe(recipeId: string): Promise<boolean> {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return false;
        }

        const { data, error } = await supabase
            .from('recipe_completions')
            .select('id')
            .eq('user_id', user.id)
            .eq('recipe_id', recipeId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return false;
            }

            throw new Error('Failed to check recipe completion status. Please try again.');
        }

        return !!data;
    },

    /**
     * Get completion count for a recipe
     */
    async getCompletionCount(recipeId: string): Promise<number> {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return 0;
        }

        const { count, error } = await supabase
            .from('recipe_completions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('recipe_id', recipeId);

        if (error) {
            throw new Error('Failed to fetch recipe completion count. Please try again.');
        }

        return count ?? 0;
    },
};

export default recipeCompletionService;
