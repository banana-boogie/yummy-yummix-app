import type { GeneratedRecipe } from '@/types/irmixy';
import { customRecipeService } from '@/services/customRecipeService';
import { getChatCustomCookingGuidePath } from '@/utils/navigation/recipeRoutes';

export interface StartCookingResult {
    recipeId: string;
    path: ReturnType<typeof getChatCustomCookingGuidePath>;
    wasNewlySaved: boolean;
}

/**
 * Save a custom recipe (if not already saved) and return the recipe ID and
 * navigation path for the cooking guide.
 *
 * Shared between text chat (useChatMessageActions) and voice chat (VoiceChatScreen).
 * Callers handle their own state updates (setMessages vs updateMessage) and navigation.
 */
export async function saveAndGetCookingPath(
    recipe: GeneratedRecipe,
    finalName: string,
    savedRecipeId?: string,
    chatSessionId?: string | null,
): Promise<StartCookingResult> {
    let recipeId = savedRecipeId;
    let wasNewlySaved = false;

    if (!recipeId) {
        const { userRecipeId } = await customRecipeService.save(recipe, finalName);
        recipeId = userRecipeId;
        wasNewlySaved = true;
    }

    return {
        recipeId: recipeId!,
        path: getChatCustomCookingGuidePath(recipeId!, chatSessionId),
        wasNewlySaved,
    };
}
