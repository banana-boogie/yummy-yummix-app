/**
 * Custom Recipe Service
 *
 * Handles saving and loading AI-generated custom recipes.
 * Uses normalized tables (user_recipe_steps, user_recipe_ingredients, etc.)
 * for schema version 1.0+, with fallback to JSONB recipe_data for legacy rows.
 */

import { supabase } from '@/lib/supabase';
import type { GeneratedRecipe, GeneratedIngredient, GeneratedStep, GeneratedUsefulItem } from '@/types/irmixy';

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

// Internal types for database rows
interface DbIngredientRow {
    id: string;
    name_en: string;
    name_es: string | null;
    quantity: number;
    unit_text: string | null;
    image_url: string | null;
    display_order: number;
}

interface DbStepIngredientRow {
    display_order: number;
    ingredient: DbIngredientRow;
}

interface DbStepRow {
    id: string;
    step_order: number;
    instruction_en: string;
    instruction_es: string | null;
    thermomix_time: number | null;
    thermomix_speed: string | null;
    thermomix_temperature: string | null;
    ingredients: DbStepIngredientRow[];
}

interface DbTagRow {
    tag_name: string;
}

interface DbUsefulItemRow {
    id: string;
    name: string;
    image_url: string | null;
    notes: string | null;
    display_order: number;
}

// ============================================================
// Service
// ============================================================

export const customRecipeService = {
    /**
     * Save a generated recipe to normalized tables.
     * Creates user_recipes row plus related ingredients, steps, and tags.
     */
    async save(
        recipe: GeneratedRecipe,
        name: string,
    ): Promise<SaveRecipeResult> {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
            throw new Error('User not authenticated');
        }

        // 1. Insert main user_recipes row
        const { data: recipeRow, error: recipeError } = await supabase
            .from('user_recipes')
            .insert({
                user_id: userData.user.id,
                name: name,
                total_time: recipe.totalTime,
                difficulty: recipe.difficulty,
                portions: recipe.portions,
                measurement_system: recipe.measurementSystem,
                language: recipe.language,
                source: 'ai_generated',
                schema_version: '1.0',
                // Keep recipe_data as backup for now
                recipe_data: recipe,
            })
            .select('id')
            .single();

        if (recipeError || !recipeRow) {
            console.error('Failed to save custom recipe:', recipeError);
            throw new Error('Failed to save recipe');
        }

        const recipeId = recipeRow.id;

        try {
            // 2. Insert ingredients
            const ingredientRows = recipe.ingredients.map((ing, index) => ({
                user_recipe_id: recipeId,
                name_en: ing.name,
                quantity: ing.quantity,
                unit_text: ing.unit,
                image_url: ing.imageUrl || null,
                display_order: index,
            }));

            const { data: insertedIngredients, error: ingError } = await supabase
                .from('user_recipe_ingredients')
                .insert(ingredientRows)
                .select('id, name_en');

            if (ingError) {
                console.error('Failed to save recipe ingredients:', ingError);
                throw new Error('Failed to save recipe ingredients');
            }

            // Create a map for ingredient name -> id lookup
            const ingredientMap = new Map<string, string>();
            for (const ing of insertedIngredients || []) {
                ingredientMap.set(ing.name_en.toLowerCase(), ing.id);
            }

            // 3. Insert steps
            const stepRows = recipe.steps.map((step) => ({
                user_recipe_id: recipeId,
                step_order: step.order,
                instruction_en: step.instruction,
                thermomix_time: step.thermomixTime || null,
                thermomix_speed: step.thermomixSpeed || null,
                thermomix_temperature: step.thermomixTemp || null,
            }));

            const { data: insertedSteps, error: stepError } = await supabase
                .from('user_recipe_steps')
                .insert(stepRows)
                .select('id, step_order');

            if (stepError) {
                console.error('Failed to save recipe steps:', stepError);
                throw new Error('Failed to save recipe steps');
            }

            // Create a map for step_order -> id lookup
            const stepMap = new Map<number, string>();
            for (const step of insertedSteps || []) {
                stepMap.set(step.step_order, step.id);
            }

            // 4. Insert step-ingredient relationships
            const stepIngredientRows: Array<{
                user_recipe_step_id: string;
                user_recipe_ingredient_id: string;
                display_order: number;
            }> = [];

            for (const step of recipe.steps) {
                if (!step.ingredientsUsed?.length) continue;

                const stepId = stepMap.get(step.order);
                if (!stepId) continue;

                for (let i = 0; i < step.ingredientsUsed.length; i++) {
                    const ingredientName = step.ingredientsUsed[i];
                    const ingredientId = ingredientMap.get(ingredientName.toLowerCase());
                    if (ingredientId) {
                        stepIngredientRows.push({
                            user_recipe_step_id: stepId,
                            user_recipe_ingredient_id: ingredientId,
                            display_order: i,
                        });
                    }
                }
            }

            if (stepIngredientRows.length > 0) {
                const { error: siError } = await supabase
                    .from('user_recipe_step_ingredients')
                    .insert(stepIngredientRows);

                if (siError) {
                    console.error('Failed to save step ingredients:', siError);
                    // Non-fatal - recipe is still usable
                }
            }

            // 5. Insert tags
            if (recipe.tags?.length) {
                const tagRows = recipe.tags.map((tagName) => ({
                    user_recipe_id: recipeId,
                    tag_name: tagName,
                }));

                const { error: tagError } = await supabase
                    .from('user_recipe_tags')
                    .insert(tagRows);

                if (tagError) {
                    console.error('Failed to save recipe tags:', tagError);
                    // Non-fatal
                }
            }

            // 6. Insert useful items
            if (recipe.usefulItems?.length) {
                const usefulItemRows = recipe.usefulItems.map((item, index) => ({
                    user_recipe_id: recipeId,
                    name: item.name,
                    image_url: item.imageUrl || null,
                    notes: item.notes || null,
                    display_order: index,
                }));

                const { error: itemsError } = await supabase
                    .from('user_recipe_useful_items')
                    .insert(usefulItemRows);

                if (itemsError) {
                    console.error('Failed to save recipe useful items:', itemsError);
                    // Non-fatal
                }
            }

            return { userRecipeId: recipeId };
        } catch (error) {
            // If any step fails after recipe creation, clean up
            // CASCADE delete will handle related tables
            await supabase
                .from('user_recipes')
                .delete()
                .eq('id', recipeId);
            throw error;
        }
    },

    /**
     * Load a custom recipe by ID.
     * Returns normalized data reconstructed into GeneratedRecipe format
     * for compatibility with existing adapters.
     */
    async load(userRecipeId: string): Promise<{
        id: string;
        name: string;
        recipe: GeneratedRecipe;
        source: string;
        createdAt: string;
    }> {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
            throw new Error('User not authenticated');
        }

        // First fetch the main recipe to check schema version
        const { data: recipeData, error: recipeError } = await supabase
            .from('user_recipes')
            .select(`
                id, name, source, created_at, schema_version,
                total_time, difficulty, portions, measurement_system, language,
                recipe_data
            `)
            .eq('id', userRecipeId)
            .eq('user_id', userData.user.id)
            .single();

        if (recipeError || !recipeData) {
            console.error('Failed to load custom recipe:', recipeError);
            throw new Error('Failed to load recipe');
        }

        // For legacy recipes without schema_version, use JSONB fallback
        if (recipeData.schema_version !== '1.0') {
            return {
                id: recipeData.id,
                name: recipeData.name,
                recipe: recipeData.recipe_data as GeneratedRecipe,
                source: recipeData.source,
                createdAt: recipeData.created_at,
            };
        }

        // Load from normalized tables
        const { data: stepsData, error: stepsError } = await supabase
            .from('user_recipe_steps')
            .select(`
                id, step_order, instruction_en, instruction_es,
                thermomix_time, thermomix_speed, thermomix_temperature,
                ingredients:user_recipe_step_ingredients (
                    display_order,
                    ingredient:user_recipe_ingredients (
                        id, name_en, name_es, quantity, unit_text, image_url, display_order
                    )
                )
            `)
            .eq('user_recipe_id', userRecipeId)
            .order('step_order', { ascending: true });

        if (stepsError) {
            console.error('Failed to load recipe steps:', stepsError);
            throw new Error('Failed to load recipe steps');
        }

        const { data: ingredientsData, error: ingredientsError } = await supabase
            .from('user_recipe_ingredients')
            .select('id, name_en, name_es, quantity, unit_text, image_url, display_order')
            .eq('user_recipe_id', userRecipeId)
            .order('display_order', { ascending: true });

        if (ingredientsError) {
            console.error('Failed to load recipe ingredients:', ingredientsError);
            throw new Error('Failed to load recipe ingredients');
        }

        const { data: tagsData } = await supabase
            .from('user_recipe_tags')
            .select('tag_name')
            .eq('user_recipe_id', userRecipeId);

        const { data: usefulItemsData } = await supabase
            .from('user_recipe_useful_items')
            .select('id, name, image_url, notes, display_order')
            .eq('user_recipe_id', userRecipeId)
            .order('display_order', { ascending: true });

        // Transform to GeneratedRecipe format
        const ingredients: GeneratedIngredient[] = (ingredientsData || []).map((ing) => ({
            name: ing.name_en,
            quantity: Number(ing.quantity),
            unit: ing.unit_text || '',
            imageUrl: ing.image_url || undefined,
        }));

        const steps: GeneratedStep[] = (stepsData as DbStepRow[] || []).map((step) => {
            // Get ingredient names used in this step
            const ingredientsUsed = (step.ingredients || [])
                .sort((a, b) => a.display_order - b.display_order)
                .map((si) => si.ingredient?.name_en)
                .filter(Boolean) as string[];

            return {
                order: step.step_order,
                instruction: step.instruction_en,
                ingredientsUsed,
                thermomixTime: step.thermomix_time || undefined,
                thermomixSpeed: step.thermomix_speed || undefined,
                thermomixTemp: step.thermomix_temperature || undefined,
            };
        });

        const usefulItems: GeneratedUsefulItem[] = (usefulItemsData as DbUsefulItemRow[] || []).map((item) => ({
            name: item.name,
            imageUrl: item.image_url || undefined,
            notes: item.notes || undefined,
        }));

        const generatedRecipe: GeneratedRecipe = {
            schemaVersion: '1.0',
            suggestedName: recipeData.name,
            measurementSystem: recipeData.measurement_system as 'imperial' | 'metric' || 'metric',
            language: recipeData.language as 'en' | 'es' || 'en',
            ingredients,
            steps,
            totalTime: recipeData.total_time || 0,
            difficulty: recipeData.difficulty as 'easy' | 'medium' | 'hard' || 'easy',
            portions: recipeData.portions || 4,
            tags: (tagsData as DbTagRow[] || []).map((t) => t.tag_name),
            usefulItems,
        };

        return {
            id: recipeData.id,
            name: recipeData.name,
            recipe: generatedRecipe,
            source: recipeData.source,
            createdAt: recipeData.created_at,
        };
    },

    /**
     * List all user's custom recipes.
     * Uses denormalized columns on user_recipes for efficiency.
     */
    async list(): Promise<UserRecipeSummary[]> {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
            throw new Error('User not authenticated');
        }

        const { data, error } = await supabase
            .from('user_recipes')
            .select('id, name, source, created_at, total_time, difficulty, recipe_data, schema_version')
            .eq('user_id', userData.user.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('Failed to list custom recipes:', error);
            throw new Error('Failed to list recipes');
        }

        return data.map((item) => {
            // For schema 1.0, use denormalized columns
            if (item.schema_version === '1.0') {
                return {
                    id: item.id,
                    name: item.name,
                    source: item.source as UserRecipeSummary['source'],
                    createdAt: item.created_at,
                    totalTime: item.total_time || undefined,
                    difficulty: item.difficulty as UserRecipeSummary['difficulty'] || undefined,
                };
            }

            // Legacy recipes without schema_version - fall back to JSONB
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
     * CASCADE delete handles related tables automatically.
     */
    async delete(userRecipeId: string): Promise<void> {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
            throw new Error('User not authenticated');
        }

        const { error } = await supabase
            .from('user_recipes')
            .delete()
            .eq('id', userRecipeId)
            .eq('user_id', userData.user.id);

        if (error) {
            console.error('Failed to delete custom recipe:', error);
            throw new Error('Failed to delete recipe');
        }
    },
};
