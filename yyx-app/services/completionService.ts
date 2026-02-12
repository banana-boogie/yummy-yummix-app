import { supabase } from '@/lib/supabase';
import { validateRecipeIsPublished } from '@/services/recipeValidation';

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

        // Validate recipe exists and is published
        await validateRecipeIsPublished(recipeId);

        // Check for existing completion
        const { data: existing, error: fetchError } = await supabase
            .from('recipe_completions')
            .select('id, completion_count')
            .eq('user_id', user.id)
            .eq('recipe_id', recipeId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            // PGRST116 = no rows found, which is expected for first completion
            throw new Error('Failed to record recipe completion. Please try again.');
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

            if (updateError) {
                throw new Error('Failed to record recipe completion. Please try again.');
            }
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

            // Handle race condition: another request inserted between our check and insert
            if (insertError && insertError.code === '23505') {
                // Unique violation — row was created concurrently, retry as update
                const { data: retryExisting } = await supabase
                    .from('recipe_completions')
                    .select('id, completion_count')
                    .eq('user_id', user.id)
                    .eq('recipe_id', recipeId)
                    .single();

                if (retryExisting) {
                    const { error: retryUpdateError } = await supabase
                        .from('recipe_completions')
                        .update({
                            completion_count: retryExisting.completion_count + 1,
                            last_completed_at: new Date().toISOString(),
                        })
                        .eq('id', retryExisting.id);

                    if (retryUpdateError) {
                        throw new Error('Failed to record recipe completion. Please try again.');
                    }
                }
            } else if (insertError) {
                throw new Error('Failed to record recipe completion. Please try again.');
            }
        }

        // Log to user_events for AI learning (fire-and-forget)
        supabase
            .from('user_events')
            .insert({
                user_id: user.id,
                event_type: 'cook_complete',
                payload: { recipe_id: recipeId },
            })
            .then(() => { /* ignore */ });
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
