/**
 * Custom Recipe Service
 *
 * Handles saving and loading AI-generated custom recipes from user_recipes table.
 */

import { supabase } from '@/lib/supabase';
import type { GeneratedRecipe } from '@/types/irmixy';

// ============================================================
// Types
// ============================================================

export interface UserRecipeSummary {
    id: string;
    name: string;
    source: 'ai_generated' | 'ai_modified' | 'user_created';
    createdAt: string;
    totalTime?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
}

export interface SaveRecipeResult {
    userRecipeId: string;
}

// ============================================================
// Service
// ============================================================

export const customRecipeService = {
    /**
     * Save a generated recipe to user_recipes.
     * Returns the new user recipe ID.
     */
    async save(
        recipe: GeneratedRecipe,
        name: string,
    ): Promise<SaveRecipeResult> {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
            throw new Error('User not authenticated');
        }

        const { data, error } = await supabase
            .from('user_recipes')
            .insert({
                user_id: userData.user.id,
                name: name,
                recipe_data: {
                    ...recipe,
                    schemaVersion: '1.0',
                },
                source: 'ai_generated',
            })
            .select('id')
            .single();

        if (error) {
            console.error('Failed to save custom recipe:', error);
            throw new Error('Failed to save recipe');
        }

        return { userRecipeId: data.id };
    },

    /**
     * Load a custom recipe by ID.
     * Returns the full recipe data.
     */
    async load(userRecipeId: string): Promise<{
        id: string;
        name: string;
        recipe: GeneratedRecipe;
        source: string;
        createdAt: string;
    }> {
        // Verify user authentication - RLS should also enforce this but be explicit
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
            throw new Error('User not authenticated');
        }

        const { data, error } = await supabase
            .from('user_recipes')
            .select('id, name, recipe_data, source, created_at')
            .eq('id', userRecipeId)
            .eq('user_id', userData.user.id) // Verify ownership
            .single();

        if (error) {
            console.error('Failed to load custom recipe:', error);
            throw new Error('Failed to load recipe');
        }

        return {
            id: data.id,
            name: data.name,
            recipe: data.recipe_data as GeneratedRecipe,
            source: data.source,
            createdAt: data.created_at,
        };
    },

    /**
     * List all user's custom recipes.
     * Returns summary info for display in a list.
     */
    async list(): Promise<UserRecipeSummary[]> {
        const { data, error } = await supabase
            .from('user_recipes')
            .select('id, name, source, created_at, recipe_data')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('Failed to list custom recipes:', error);
            throw new Error('Failed to list recipes');
        }

        return data.map((item) => {
            const recipeData = item.recipe_data as GeneratedRecipe | null;
            return {
                id: item.id,
                name: item.name,
                source: item.source as UserRecipeSummary['source'],
                createdAt: item.created_at,
                totalTime: recipeData?.totalTime,
                difficulty: recipeData?.difficulty,
            };
        });
    },

    /**
     * Delete a custom recipe.
     */
    async delete(userRecipeId: string): Promise<void> {
        // Verify user authentication
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
            throw new Error('User not authenticated');
        }

        const { error } = await supabase
            .from('user_recipes')
            .delete()
            .eq('id', userRecipeId)
            .eq('user_id', userData.user.id); // Verify ownership

        if (error) {
            console.error('Failed to delete custom recipe:', error);
            throw new Error('Failed to delete recipe');
        }
    },
};
