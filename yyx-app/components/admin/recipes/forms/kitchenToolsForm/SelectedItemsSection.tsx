import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { AdminRecipeKitchenTool } from '@/types/recipe.admin.types';
import { AdminRecipeKitchenToolCard } from './AdminRecipeKitchenToolCard';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

interface SelectedItemsSectionProps {
    items: AdminRecipeKitchenTool[];
    displayLocale?: string;
    onEdit: (item: AdminRecipeKitchenTool) => void;
    onDelete: (item: AdminRecipeKitchenTool) => void;
    onMoveUp: (item: AdminRecipeKitchenTool) => void;
    onMoveDown: (item: AdminRecipeKitchenTool) => void;
    /** Compact variant for mobile (no min-height constraint) */
    variant?: 'default' | 'compact';
}

/**
 * Displays the list of selected kitchen tools for a recipe.
 * Used in both mobile and desktop layouts of RecipeKitchenToolsForm.
 */
export function SelectedItemsSection({
    items,
    displayLocale = 'es',
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
    variant = 'default'
}: SelectedItemsSectionProps) {
    const isCompact = variant === 'compact';

    return (
        <View>
            <View className="flex-row justify-between items-center mb-sm">
                <Text preset="bodySmall" className="text-text-secondary font-medium">
                    {i18n.t('admin.recipes.form.kitchenToolsInfo.selectedHeader')}
                </Text>
                <Text preset="caption" color={COLORS.text.secondary}>
                    {i18n.t('admin.recipes.form.kitchenToolsInfo.selectedCount', {
                        count: items.length || 0,
                    })}
                </Text>
            </View>

            {items.length === 0 ? (
                <View className={`p-lg items-center justify-center bg-background-secondary rounded-md ${isCompact ? 'min-h-[120px]' : 'min-h-[400px]'}`}>
                    <Ionicons name="information-circle-outline" size={32} color={COLORS.text.secondary} />
                    <Text className="mt-sm text-center" color={COLORS.text.secondary}>
                        {i18n.t('admin.recipes.form.kitchenToolsInfo.noSelectedItems')}
                    </Text>
                </View>
            ) : (
                <View className={`p-xs bg-background-secondary rounded-md ${isCompact ? '' : 'min-h-[400px]'}`}>
                    {items.map((recipeKitchenTool, index) => (
                        <AdminRecipeKitchenToolCard
                            key={recipeKitchenTool.id}
                            recipeKitchenTool={recipeKitchenTool}
                            displayLocale={displayLocale}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onMoveUp={onMoveUp}
                            onMoveDown={onMoveDown}
                            isFirst={index === 0}
                            isLast={index === items.length - 1}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}
