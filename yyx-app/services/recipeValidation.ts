import { supabase } from '@/lib/supabase';

/**
 * Validate that a recipe exists and is published.
 * Shared by ratingService and completionService.
 */
export async function validateRecipeIsPublished(recipeId: string): Promise<void> {
    const { data, error } = await supabase
        .from('recipes')
        .select('id, is_published')
        .eq('id', recipeId)
        .single();

    if (error || !data) {
        throw new Error('Recipe not found');
    }

    if (!data.is_published) {
        throw new Error('Recipe is not available');
    }
}
