import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/common';
import { ShoppingListItem } from '@/types/shopping-list.types';
import { COLORS } from '@/constants/design-tokens';
import { formatQuantity } from '@/utils/formatQuantity';
import i18n from '@/i18n';

interface ShoppingListItemRowProps {
    item: ShoppingListItem;
    onCheck: () => void;
    onPress: () => void;
    onLongPress?: () => void;
    onMore?: () => void;
    onQuantityChange?: (quantity: number) => void;
    isSelectMode?: boolean;
    isSelected?: boolean;
}

/**
 * Row anatomy: [checkbox] [image] Name / qty unit [⋯]
 *
 * Tap the checkbox always toggles isChecked (or selection in select mode).
 * Tap the row body opens the edit modal.
 * Tap ⋯ opens the per-row action sheet (edit / delete).
 * Long-press anywhere enters select mode.
 */
export const ShoppingListItemRow = React.memo(function ShoppingListItemRow({
    item,
    onCheck,
    onPress,
    onLongPress,
    onMore,
    onQuantityChange,
    isSelectMode = false,
    isSelected = false,
}: ShoppingListItemRowProps) {
    // Haptic + check fire-and-forget. Awaiting Haptics gives a window where a
    // rapid second tap re-reads `item.isChecked` after re-render and flips back.
    const handleCheck = () => {
        // Fire-and-forget. Don't await — see comment above.
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onCheck();
    };

    const handleQuantityChange = (increment: boolean) => {
        if (!onQuantityChange) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newQuantity = increment ? item.quantity + 1 : Math.max(0.5, item.quantity - 1);
        onQuantityChange(newQuantity);
    };

    const displayQuantity = () => {
        const unit = item.unit?.symbol || '';
        return `${formatQuantity(item.quantity)} ${unit}`.trim();
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.7}
            delayLongPress={400}
            className={`mb-xs bg-white rounded-lg px-md py-sm flex-row items-center ${item.isChecked && !isSelectMode ? 'opacity-60' : ''} ${isSelected ? 'bg-primary-lightest' : ''}`}
        >
            {/* Checkbox / Selection indicator */}
            <TouchableOpacity
                onPress={handleCheck}
                className="mr-sm"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={i18n.t('shoppingList.accessibility.toggleItem', { name: item.name })}
            >
                <View
                    className={`w-6 h-6 rounded-[4px] border-2 items-center justify-center ${
                        isSelectMode
                            ? (isSelected ? 'bg-primary-default border-primary-default' : 'bg-white border-grey-medium')
                            : (item.isChecked ? 'bg-primary-medium border-primary-medium' : 'bg-white border-grey-medium')
                    }`}
                >
                    {(isSelectMode ? isSelected : item.isChecked) && (
                        <Ionicons name="checkmark" size={16} color={COLORS.neutral.white} />
                    )}
                </View>
            </TouchableOpacity>

            {/* Item image — placeholder icon for custom items (no canonical
                ingredient = no pictureUrl) keeps row heights vertically aligned. */}
            {item.pictureUrl ? (
                <View className="w-12 h-12 rounded-sm overflow-hidden mr-sm bg-grey-light">
                    <Image
                        source={{ uri: item.pictureUrl }}
                        style={{ width: 48, height: 48 }}
                        contentFit="cover"
                        transition={200}
                    />
                </View>
            ) : (
                <View className="w-12 h-12 rounded-sm mr-sm bg-grey-lightest items-center justify-center">
                    <Ionicons name="cube-outline" size={22} color={COLORS.grey.medium} />
                </View>
            )}

            {/* Item details */}
            <View className="flex-1 mr-sm">
                <Text
                    preset="body"
                    className={`${item.isChecked ? 'line-through text-text-secondary' : 'text-text-default'}`}
                    numberOfLines={1}
                >
                    {item.name}
                </Text>
                <View className="flex-row items-center mt-xxs">
                    <Text preset="caption" className="text-text-secondary">
                        {displayQuantity()}
                    </Text>
                    {item.notes && (
                        <>
                            <View className="w-1 h-1 rounded-full bg-grey-medium mx-xs" />
                            <Text preset="caption" className="text-text-secondary flex-1" numberOfLines={1}>
                                {item.notes}
                            </Text>
                        </>
                    )}
                </View>
            </View>

            {/* Quantity controls (optional) */}
            {onQuantityChange && !item.isChecked && !isSelectMode && (
                <View className="flex-row items-center bg-grey-light rounded-lg mr-sm">
                    <TouchableOpacity
                        onPress={() => handleQuantityChange(false)}
                        className="px-sm py-xs"
                        activeOpacity={0.7}
                        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                        accessibilityRole="button"
                        accessibilityLabel={i18n.t('shoppingList.accessibility.decreaseQuantity', { name: item.name })}
                    >
                        <Ionicons name="remove" size={18} color={COLORS.primary.darkest} />
                    </TouchableOpacity>
                    <View className="w-px h-4 bg-grey-medium" />
                    <TouchableOpacity
                        onPress={() => handleQuantityChange(true)}
                        className="px-sm py-xs"
                        activeOpacity={0.7}
                        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                        accessibilityRole="button"
                        accessibilityLabel={i18n.t('shoppingList.accessibility.increaseQuantity', { name: item.name })}
                    >
                        <Ionicons name="add" size={18} color={COLORS.primary.darkest} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Per-row action menu trigger (hidden in select mode). */}
            {!isSelectMode && onMore && (
                <TouchableOpacity
                    onPress={onMore}
                    className="px-xs py-xs"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={i18n.t('shoppingList.accessibility.itemActions', { name: item.name })}
                >
                    <Ionicons name="ellipsis-vertical" size={20} color={COLORS.grey.medium} />
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
});
