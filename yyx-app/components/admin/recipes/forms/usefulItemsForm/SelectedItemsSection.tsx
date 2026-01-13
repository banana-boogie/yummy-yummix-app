import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { AdminRecipeUsefulItem } from '@/types/recipe.admin.types';
import { AdminRecipeUsefulItemCard } from './AdminRecipeUsefulItemCard';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

interface SelectedItemsSectionProps {
    items: AdminRecipeUsefulItem[];
    onEdit: (item: AdminRecipeUsefulItem) => void;
    onDelete: (item: AdminRecipeUsefulItem) => void;
    onMoveUp: (item: AdminRecipeUsefulItem) => void;
    onMoveDown: (item: AdminRecipeUsefulItem) => void;
    /** Compact variant for mobile (no min-height constraint) */
    variant?: 'default' | 'compact';
}

/**
 * Displays the list of selected useful items for a recipe.
 * Used in both mobile and desktop layouts of RecipeUsefulItemsForm.
 */
export function SelectedItemsSection({
    items,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
    variant = 'default'
}: SelectedItemsSectionProps) {
    const isCompact = variant === 'compact';

    return (
        <View>
            <View className="flex-row justify-between items-center p-sm bg-background-SECONDARY rounded-md mb-sm">
                <Text preset="subheading">
                    {i18n.t('admin.recipes.form.usefulItemsInfo.selectedHeader')}
                </Text>
                <Text preset="caption" color={COLORS.text.secondary}>
                    {i18n.t('admin.recipes.form.usefulItemsInfo.selectedCount', {
                        count: items.length || 0,
                    })}
                </Text>
            </View>

            {items.length === 0 ? (
                <View className={`p-lg items-center justify-center bg-background-SECONDARY rounded-md ${isCompact ? 'min-h-[120px]' : 'min-h-[400px]'}`}>
                    <Ionicons name="information-circle-outline" size={32} color={COLORS.text.secondary} />
                    <Text className="mt-sm text-center" color={COLORS.text.secondary}>
                        {i18n.t('admin.recipes.form.usefulItemsInfo.noSelectedItems')}
                    </Text>
                </View>
            ) : (
                <View className={`p-xs bg-background-SECONDARY rounded-md ${isCompact ? '' : 'min-h-[400px]'}`}>
                    {items.map((recipeUsefulItem, index) => (
                        <AdminRecipeUsefulItemCard
                            key={recipeUsefulItem.id}
                            recipeUsefulItem={recipeUsefulItem}
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
