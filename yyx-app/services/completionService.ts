import { supabase } from '@/lib/supabase';

/**
 * Service for tracking recipe completions
 */
export const completionService = {
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
            throw new Error('Recipe is not available');
        }
    },

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

        try {
            // Validate recipe exists and is published
            await this.validateRecipe(recipeId);
            // Check for existing completion
            const { data: existing, error: fetchError } = await supabase
                .from('recipe_completions')
                .select('id, completion_count')
                .eq('user_id', user.id)
                .eq('recipe_id', recipeId)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                // PGRST116 = no rows found, which is expected for first completion
                throw fetchError;
            }

            if (existing) {
                // Update existing completion
                const { error: updateError } = await supabase
                    .from('recipe_completions')
                    .update({
                        completion_count: existing.completion_count + 1,
                        last_completed_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id);

                if (updateError) throw updateError;
            } else {
                // Insert new completion
                const { error: insertError } = await supabase
                    .from('recipe_completions')
                    .insert({
                        user_id: user.id,
                        recipe_id: recipeId,
                        completion_count: 1,
                        first_completed_at: new Date().toISOString(),
                        last_completed_at: new Date().toISOString(),
                    });

                if (insertError) throw insertError;
            }

            // Log to user_events for AI learning (will be available when AI foundation merges)
            try {
                await supabase
                    .from('user_events')
                    .insert({
                        user_id: user.id,
                        event_type: 'cook_complete',
                        payload: { recipe_id: recipeId },
                    });
            } catch (eventError) {
                // Silent fail - user_events table doesn't exist yet
                // Will work automatically when AI foundation feature merges
                console.log('user_events logging skipped (table not yet available)');
            }
        } catch (error) {
            console.error('Failed to record recipe completion:', error);
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
