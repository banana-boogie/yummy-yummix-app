/**
 * Action Registry
 *
 * Maps action types to frontend handlers.
 * Adding a new action = adding an entry to ACTION_HANDLERS.
 */

import { Share } from 'react-native';
import { router } from 'expo-router';
import type { Action, GeneratedRecipe, RecipeCard } from '@/types/irmixy';

export interface ActionContext {
    /** The current custom recipe from the message */
    currentRecipe?: GeneratedRecipe;
    /** Recipe cards from the message */
    recipes?: RecipeCard[];
}

export interface ActionContextSource {
    id?: string;
    role?: string;
    customRecipe?: GeneratedRecipe;
    recipes?: RecipeCard[];
}

interface ActionHandler {
    execute: (payload: Record<string, unknown>, context?: ActionContext) => boolean | Promise<boolean>;
}

function hasRecipeContext(context?: ActionContext): boolean {
    return !!context?.currentRecipe || !!context?.recipes?.length;
}

function toActionContext(source?: ActionContextSource): ActionContext | undefined {
    if (!source) return undefined;
    const context: ActionContext = {
        currentRecipe: source.customRecipe,
        recipes: source.recipes,
    };
    return hasRecipeContext(context) ? context : undefined;
}

/**
 * Resolve action context from chat/transcript messages.
 * 1) Prefer context from a specific message ID (if provided)
 * 2) Fallback to the most recent assistant message with recipe data
 */
export function resolveActionContext(
    messages: ActionContextSource[],
    preferredMessageId?: string,
): ActionContext | undefined {
    if (preferredMessageId) {
        const preferred = messages.find((message) => message.id === preferredMessageId);
        const preferredContext = toActionContext(preferred);
        if (preferredContext) return preferredContext;
    }

    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.role !== 'assistant') continue;
        const context = toActionContext(message);
        if (context) return context;
    }

    return undefined;
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
                await Share.share({ message });
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
