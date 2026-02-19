/**
 * Action Registry
 *
 * Maps action types to frontend handlers.
 * Adding a new action = adding an entry to ACTION_HANDLERS.
 */

import { Share, Platform } from 'react-native';
import { router } from 'expo-router';
import type { Action, GeneratedRecipe, RecipeCard } from '@/types/irmixy';

export interface ActionContext {
    /** The current custom recipe from the message */
    currentRecipe?: GeneratedRecipe;
    /** Recipe cards from the message */
    recipes?: RecipeCard[];
}

interface ActionHandler {
    execute: (payload: Record<string, unknown>, context?: ActionContext) => boolean | Promise<boolean>;
}

function formatRecipeForSharing(recipe: GeneratedRecipe): string {
    const lines: string[] = [];
    lines.push(recipe.suggestedName);
    lines.push('');

    if (recipe.ingredients.length > 0) {
        lines.push(recipe.language === 'es' ? 'Ingredientes:' : 'Ingredients:');
        for (const ing of recipe.ingredients) {
            lines.push(`- ${ing.quantity} ${ing.unit} ${ing.name}`);
        }
        lines.push('');
    }

    if (recipe.steps.length > 0) {
        lines.push(recipe.language === 'es' ? 'Pasos:' : 'Steps:');
        for (const step of recipe.steps) {
            lines.push(`${step.order}. ${step.instruction}`);
        }
    }

    lines.push('');
    lines.push('— YummyYummix');

    return lines.join('\n');
}

const ACTION_HANDLERS: Record<string, ActionHandler> = {
    view_recipe: {
        execute: (payload) => {
            const recipeId = payload.recipeId as string;
            if (!recipeId) return false;
            router.push(`/(tabs)/recipes/${recipeId}?from=chat`);
            return true;
        },
    },
    share_recipe: {
        execute: async (_payload, context) => {
            if (!context?.currentRecipe && !context?.recipes?.length) {
                return false;
            }

            let message: string;
            if (context.currentRecipe) {
                message = formatRecipeForSharing(context.currentRecipe);
            } else if (context.recipes && context.recipes.length > 0) {
                const recipe = context.recipes[0];
                message = `${recipe.name}\n\n— YummyYummix`;
            } else {
                return false;
            }

            try {
                await Share.share({
                    message: Platform.OS === 'ios' ? message : message,
                });
                return true;
            } catch {
                return false;
            }
        },
    },
};

/**
 * Execute an action via the registry.
 * Returns true if handled, false if not (unknown type, missing context, etc.)
 */
export function executeAction(
    action: Action,
    context?: ActionContext,
): boolean | Promise<boolean> {
    const handler = ACTION_HANDLERS[action.type];
    if (!handler) return false;

    try {
        return handler.execute(action.payload, context);
    } catch {
        return false;
    }
}
