/**
 * Builds a RecipeContext for IrmixyCookingModal from recipe data.
 *
 * Centralizes the repeated mapping of ingredients, steps, and tools
 * that was duplicated across 9+ cooking guide screens.
 */
import type { RecipeContext } from '@/services/voice/types';
import { formatSpeedText } from '@/utils/thermomix/assetUtils';

/** Minimal recipe shape accepted by the builder — matches both DB and custom recipes. */
interface RecipeData {
    id?: string;
    name?: string;
    ingredients?: { name: string; formattedQuantity: string; formattedUnit: string }[];
    kitchenTools?: { name: string }[];
    steps?: { order: number; instruction: string; thermomix?: { time?: number | null; speed?: number | null } | null }[];
    portions?: number;
    totalTime?: number | null;
}

interface BuildOptions {
    type: RecipeContext['type'];
    recipeId: string;
    /** Override specific fields (currentStep, totalSteps, stepInstructions, etc.) */
    overrides?: Partial<Pick<RecipeContext, 'currentStep' | 'totalSteps' | 'stepInstructions' | 'ingredients' | 'kitchenTools'>>;
}

export function buildRecipeContext(recipe: RecipeData | null | undefined, options: BuildOptions): RecipeContext {
    return {
        type: options.type,
        recipeId: options.recipeId,
        recipeTitle: recipe?.name,
        ingredients: options.overrides?.ingredients ?? recipe?.ingredients?.map(ing => ({
            name: ing.name,
            amount: `${ing.formattedQuantity} ${ing.formattedUnit}`.trim(),
        })),
        kitchenTools: options.overrides?.kitchenTools ?? recipe?.kitchenTools?.map(t => t.name),
        allSteps: recipe?.steps?.map(s => ({
            order: s.order,
            instruction: s.instruction,
            thermomixTime: s.thermomix?.time,
            thermomixSpeed: s.thermomix?.speed ? formatSpeedText(s.thermomix.speed) : null,
        })),
        portions: recipe?.portions,
        totalTime: recipe?.totalTime ?? undefined,
        ...options.overrides,
    };
}
