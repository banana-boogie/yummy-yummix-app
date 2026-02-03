/**
 * Recipe Adapter
 *
 * Transforms GeneratedRecipe (from AI) to Recipe type (for cooking guide).
 * Creates synthetic IDs and minimal measurement unit objects.
 */

import type { GeneratedRecipe, GeneratedIngredient, GeneratedStep, GeneratedUsefulItem } from '@/types/irmixy';
import type {
    Recipe,
    RecipeIngredient,
    RecipeStep,
    RecipeStepIngredient,
    RecipeUsefulItem,
    MeasurementUnit,
    RecipeDifficulty,
} from '@/types/recipe.types';
import type {
    ThermomixSettings,
    ThermomixSpeed,
    ThermomixTemperature,
    ThermomixTemperatureUnit,
} from '@/types/thermomix.types';

/**
 * Generate a synthetic UUID for client-side use.
 */
function generateSyntheticId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// Pre-compiled regex patterns for unit type detection (performance optimization)
const VOLUME_UNIT_PATTERN = /\b(cups?|tbsp|tsp|ml|liters?|fl\s*oz)\b/i;
const WEIGHT_UNIT_PATTERN = /\b(g|kg|lbs?|ounces?|grams?)\b/i;

// Pattern to parse temperature strings like "100°C", "212°F", "Varoma"
const TEMP_PATTERN = /^(\d+(?:\.\d+)?)\s*°\s*([CF])$/i;

/**
 * Parse AI's temperature string into temperature value and unit.
 * Examples: "100°C" -> { temp: 100, unit: 'C' }, "Varoma" -> { temp: 'Varoma', unit: 'C' }
 */
function parseTemperature(tempStr?: string): { temp: ThermomixTemperature; unit: ThermomixTemperatureUnit } | null {
    if (!tempStr) return null;

    const trimmed = tempStr.trim();

    // Handle special temperature "Varoma"
    if (trimmed.toLowerCase() === 'varoma') {
        return { temp: 'Varoma', unit: 'C' };
    }

    // Parse numeric temperature with unit
    const match = trimmed.match(TEMP_PATTERN);
    if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase() as 'C' | 'F';
        return { temp: value as ThermomixTemperature, unit };
    }

    return null;
}

/**
 * Parse AI's speed string into ThermomixSpeed object.
 * Examples: "5" -> { type: 'single', value: 5 }, "Spoon" -> { type: 'single', value: 'spoon' }
 * Returns isReversed flag for "Reverse" speed.
 */
function parseSpeed(speedStr?: string): { speed: ThermomixSpeed; isReversed: boolean } | null {
    if (!speedStr) return null;

    const trimmed = speedStr.trim().toLowerCase();

    // Handle "Reverse" - indicates blade reversal, typically used with a speed
    if (trimmed === 'reverse') {
        return { speed: { type: 'single', value: null }, isReversed: true };
    }

    // Handle "Spoon" speed
    if (trimmed === 'spoon') {
        return { speed: { type: 'single', value: 'spoon' }, isReversed: false };
    }

    // Parse numeric speed
    const numValue = parseFloat(trimmed);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 10) {
        return { speed: { type: 'single', value: numValue as 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5 | 5.5 | 6 | 6.5 | 7 | 7.5 | 8 | 8.5 | 9 | 9.5 | 10 }, isReversed: false };
    }

    return null;
}

/**
 * Build ThermomixSettings from AI-generated step fields.
 * Returns undefined if no thermomix parameters are present.
 */
function buildThermomixSettings(step: GeneratedStep): ThermomixSettings | undefined {
    const hasAnyThermomixField = step.thermomixTime || step.thermomixTemp || step.thermomixSpeed;
    if (!hasAnyThermomixField) {
        return undefined;
    }

    const parsedTemp = parseTemperature(step.thermomixTemp);
    const parsedSpeed = parseSpeed(step.thermomixSpeed);

    return {
        time: step.thermomixTime ?? null,
        temperature: parsedTemp?.temp ?? null,
        temperatureUnit: parsedTemp?.unit ?? 'C',
        speed: parsedSpeed?.speed ?? null,
        isBladeReversed: parsedSpeed?.isReversed ?? false,
    };
}

/**
 * Create a minimal MeasurementUnit from a unit string.
 * The cooking guide only uses name, symbol, and symbolPlural for display.
 */
function createMeasurementUnit(unit: string, system: 'imperial' | 'metric'): MeasurementUnit {
    // Detect unit type using pre-compiled regex patterns
    let type: 'volume' | 'weight' | 'unit' = 'unit';

    if (VOLUME_UNIT_PATTERN.test(unit)) {
        type = 'volume';
    } else if (WEIGHT_UNIT_PATTERN.test(unit)) {
        type = 'weight';
    }

    return {
        id: generateSyntheticId(),
        type,
        system: unit === '' ? 'universal' : system,
        name: unit,
        symbol: unit,
        symbolPlural: unit, // AI generates appropriate form
    };
}

/**
 * Format a quantity for display.
 * Converts decimals to fractions where appropriate.
 */
function formatQuantity(quantity: number): string {
    // Handle whole numbers
    if (Number.isInteger(quantity)) {
        return quantity.toString();
    }

    // Extract whole part and decimal
    const whole = Math.floor(quantity);
    const decimal = quantity - whole;

    // Common fractions
    const fractions: [number, string][] = [
        [0.25, '1/4'],
        [0.33, '1/3'],
        [0.5, '1/2'],
        [0.67, '2/3'],
        [0.75, '3/4'],
    ];

    // Find closest fraction
    let closestFraction = '';
    let closestDiff = 1;

    for (const [value, str] of fractions) {
        const diff = Math.abs(decimal - value);
        if (diff < closestDiff && diff < 0.1) {
            closestDiff = diff;
            closestFraction = str;
        }
    }

    if (closestFraction) {
        return whole > 0 ? `${whole} ${closestFraction}` : closestFraction;
    }

    // Fall back to decimal with 1-2 places
    return quantity.toFixed(quantity < 1 ? 2 : 1).replace(/\.?0+$/, '');
}

/**
 * Transform a GeneratedIngredient to RecipeIngredient.
 */
function transformIngredient(
    ingredient: GeneratedIngredient,
    index: number,
    measurementSystem: 'imperial' | 'metric',
): RecipeIngredient {
    const formattedQuantity = formatQuantity(ingredient.quantity);
    const measurementUnit = createMeasurementUnit(ingredient.unit, measurementSystem);

    return {
        id: generateSyntheticId(),
        name: ingredient.name,
        pluralName: ingredient.name, // AI generates singular form typically
        pictureUrl: ingredient.imageUrl,
        quantity: ingredient.quantity.toString(),
        measurementUnit,
        formattedQuantity,
        formattedUnit: ingredient.unit,
        notes: undefined,
        displayOrder: index + 1,
        optional: false,
        recipeSection: 'main',
    };
}

/**
 * Transform a GeneratedStep to RecipeStep.
 * Maps ingredientsUsed to full step ingredients with images.
 */
function transformStep(
    step: GeneratedStep,
    allIngredients: GeneratedIngredient[],
    measurementSystem: 'imperial' | 'metric',
): RecipeStep {
    // Map ingredientsUsed to full ingredient objects with images
    const stepIngredients: RecipeStepIngredient[] = (step.ingredientsUsed || [])
        .map((ingredientName, index) => {
            // Find matching ingredient from global list (case-insensitive)
            const matchedIngredient = allIngredients.find(
                (ing) => ing.name.toLowerCase() === ingredientName.toLowerCase()
            );

            if (!matchedIngredient) {
                // Ingredient not found in global list - still include without image
                return {
                    id: generateSyntheticId(),
                    name: ingredientName,
                    pluralName: ingredientName,
                    pictureUrl: undefined,
                    quantity: '',
                    measurementUnit: createMeasurementUnit('', measurementSystem),
                    formattedQuantity: '',
                    formattedUnit: '',
                    displayOrder: index + 1,
                    optional: false,
                };
            }

            // Return full ingredient with image
            return {
                id: generateSyntheticId(),
                name: matchedIngredient.name,
                pluralName: matchedIngredient.name,
                pictureUrl: matchedIngredient.imageUrl,
                quantity: matchedIngredient.quantity.toString(),
                measurementUnit: createMeasurementUnit(matchedIngredient.unit, measurementSystem),
                formattedQuantity: formatQuantity(matchedIngredient.quantity),
                formattedUnit: matchedIngredient.unit,
                displayOrder: index + 1,
                optional: false,
            };
        });

    return {
        id: generateSyntheticId(),
        order: step.order,
        instruction: step.instruction,
        recipeSection: null,
        thermomix: buildThermomixSettings(step),
        ingredients: stepIngredients,
    };
}

/**
 * Transform a GeneratedUsefulItem to RecipeUsefulItem.
 */
function transformUsefulItem(
    item: GeneratedUsefulItem,
    index: number,
): RecipeUsefulItem {
    return {
        id: generateSyntheticId(),
        name: item.name,
        pictureUrl: item.imageUrl || '',
        displayOrder: index + 1,
        notes: item.notes || '',
    };
}

/**
 * Validate that a GeneratedRecipe has required fields.
 * Throws an error if validation fails.
 */
function validateGeneratedRecipe(generated: unknown): asserts generated is GeneratedRecipe {
    if (!generated || typeof generated !== 'object') {
        throw new Error('Invalid recipe: expected object');
    }

    const recipe = generated as Record<string, unknown>;

    if (!Array.isArray(recipe.ingredients)) {
        throw new Error('Invalid recipe: missing ingredients array');
    }

    if (!Array.isArray(recipe.steps)) {
        throw new Error('Invalid recipe: missing steps array');
    }

    if (typeof recipe.totalTime !== 'number' || recipe.totalTime < 0) {
        throw new Error('Invalid recipe: totalTime must be a positive number');
    }

    if (typeof recipe.portions !== 'number' || recipe.portions < 1) {
        throw new Error('Invalid recipe: portions must be at least 1');
    }

    if (!['easy', 'medium', 'hard'].includes(recipe.difficulty as string)) {
        throw new Error('Invalid recipe: difficulty must be easy, medium, or hard');
    }

    if (!['imperial', 'metric'].includes(recipe.measurementSystem as string)) {
        throw new Error('Invalid recipe: measurementSystem must be imperial or metric');
    }
}

/**
 * Transform a GeneratedRecipe to a Recipe for cooking guide.
 *
 * @param generated - The AI-generated recipe
 * @param userRecipeId - The ID from user_recipes table
 * @param name - The final recipe name (may differ from suggestedName)
 * @throws Error if the generated recipe is invalid
 */
export function adaptGeneratedRecipe(
    generated: GeneratedRecipe,
    userRecipeId: string,
    name: string,
): Recipe {
    // Validate input before transformation
    validateGeneratedRecipe(generated);

    const now = new Date().toISOString();

    return {
        id: userRecipeId,
        name: name,
        pictureUrl: undefined, // AI doesn't generate images
        difficulty: generated.difficulty as RecipeDifficulty,
        prepTime: null,
        totalTime: generated.totalTime,
        portions: generated.portions,
        steps: generated.steps.map((step) =>
            transformStep(step, generated.ingredients, generated.measurementSystem)
        ),
        tipsAndTricks: undefined,
        ingredients: generated.ingredients.map((ing, index) =>
            transformIngredient(ing, index, generated.measurementSystem)
        ),
        tags: generated.tags.map((tagName) => ({
            id: generateSyntheticId(),
            name: tagName,
            categories: [],
        })),
        usefulItems: (generated.usefulItems || []).map((item, index) =>
            transformUsefulItem(item, index)
        ),
        isPublished: false, // User recipes are not published
        createdAt: now,
        updatedAt: now,
    };
}
