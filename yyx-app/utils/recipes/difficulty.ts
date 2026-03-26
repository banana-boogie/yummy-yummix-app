import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

/**
 * Returns a NativeWind text color class for the given difficulty level.
 * Used in ChatRecipeCard where colors are applied via className.
 */
export function getDifficultyColorClass(difficulty: string): string {
    switch (difficulty) {
        case 'easy': return 'text-status-success';
        case 'medium': return 'text-yellow-600';
        case 'hard': return 'text-status-error';
        default: return 'text-text-secondary';
    }
}

/**
 * Returns a hex color value for the given difficulty level.
 * Used in CustomRecipeCard where colors are applied via style prop.
 */
export function getDifficultyColor(difficulty: string): string {
    switch (difficulty) {
        case 'easy': return COLORS.status.success;
        case 'medium': return COLORS.status.medium;
        case 'hard': return COLORS.status.error;
        default: return COLORS.grey.medium;
    }
}

/**
 * Returns the localized label for a difficulty level.
 */
export function getDifficultyLabel(difficulty: string): string {
    return i18n.t(`recipes.common.difficulty.${difficulty}`);
}
