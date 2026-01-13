import { supabase } from '@/lib/supabase';

/**
 * Service for tracking recipe completions
 */
export const completionService = {
    /**
     * Record a recipe completion
     * - Upserts to recipe_completions (increments count if exists)
     * - Logs cook_complete event to user_events for AI learning
     */
    async recordCompletion(recipeId: string): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            // Silently skip for non-logged-in users
            return;
        }

        // Check for existing completion
        const { data: existing } = await supabase
            .from('recipe_completions')
            .select('id, completion_count')
            .eq('user_id', user.id)
            .eq('recipe_id', recipeId)
            .single();

        if (existing) {
            // Update existing completion
            await supabase
                .from('recipe_completions')
                .update({
                    completion_count: existing.completion_count + 1,
                    last_completed_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
        } else {
            // Insert new completion
            await supabase
                .from('recipe_completions')
                .insert({
                    user_id: user.id,
                    recipe_id: recipeId,
                    completion_count: 1,
                    first_completed_at: new Date().toISOString(),
                    last_completed_at: new Date().toISOString(),
                });
        }

        // Log to user_events for AI learning
        await supabase
            .from('user_events')
            .insert({
                user_id: user.id,
                event_type: 'cook_complete',
                payload: { recipe_id: recipeId },
            });
    },

    /**
     * Check if user has completed a recipe
     */
    async hasCompletedRecipe(recipeId: string): Promise<boolean> {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return false;
        }

        const { data } = await supabase
            .from('recipe_completions')
            .select('id')
            .eq('user_id', user.id)
            .eq('recipe_id', recipeId)
            .single();

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

        const { data } = await supabase
            .from('recipe_completions')
            .select('completion_count')
            .eq('user_id', user.id)
            .eq('recipe_id', recipeId)
            .single();

        return data?.completion_count ?? 0;
    },
};

export default completionService;
