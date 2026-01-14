import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ShoppingListItem } from '@/types/shopping-list.types';
import { ShoppingListItemRow } from './ShoppingListItem';
import { COLORS } from '@/constants/design-tokens';

interface DraggableShoppingListItemProps {
    item: ShoppingListItem;
    onCheck: () => void;
    onDelete: () => void;
    onPress: () => void;
    onQuantityChange?: (qty: number) => void;
    drag: () => void; // from DraggableFlatList
    isActive: boolean; // from DraggableFlatList
}

export const DraggableShoppingListItem = React.memo(function DraggableShoppingListItem({
    item,
    drag,
    isActive,
    onCheck,
    onDelete,
    onPress,
    onQuantityChange
}: DraggableShoppingListItemProps) {
    const handleDragStart = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        drag();
    };

    return (
        <View
            className={`flex-row items-center ${isActive ? 'opacity-80' : ''}`}
            style={isActive ? {
                transform: [{ scale: 1.03 }],
                shadowColor: COLORS.shadow.default,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
            } : undefined}
        >
            {/* Drag handle on left */}
            <TouchableOpacity
                onLongPress={handleDragStart}
                onPressIn={drag}
                className="w-10 items-center justify-center"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.6}
            >
                <Ionicons
                    name="reorder-three-outline"
                    size={20}
                    color={isActive ? COLORS.primary.medium : COLORS.grey.medium}
                />
            </TouchableOpacity>

            {/* Existing item component */}
            <View className="flex-1">
                <ShoppingListItemRow
                    item={item}
                    onCheck={onCheck}
                    onDelete={onDelete}
                    onPress={onPress}
                    onQuantityChange={onQuantityChange}
                />
            </View>
        </View>
    );
});
