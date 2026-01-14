import React, { useState } from 'react';
import { View, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { Text } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { ShoppingCategoryWithItems, ShoppingListItem, CATEGORY_ICONS } from '@/types/shopping-list.types';
import { ShoppingListItemRow } from './ShoppingListItem';
import { DraggableShoppingListItem } from './DraggableShoppingListItem';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CategorySectionProps {
    category: ShoppingCategoryWithItems;
    onCheckItem: (itemId: string, isChecked: boolean) => void;
    onDeleteItem: (itemId: string) => void;
    onPressItem: (itemId: string) => void;
    onQuantityChange?: (itemId: string, quantity: number) => void;
    onReorderItems?: (items: ShoppingListItem[]) => void;
    defaultExpanded?: boolean;
}

export function CategorySection({ category, onCheckItem, onDeleteItem, onPressItem, onQuantityChange, onReorderItems, defaultExpanded = true }: CategorySectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // Separate unchecked and checked items
    const uncheckedItems = category.items.filter(item => !item.isChecked);
    const checkedItems = category.items.filter(item => item.isChecked);

    const checkedCount = checkedItems.length;
    const totalCount = category.items.length;
    const allChecked = totalCount > 0 && checkedCount === totalCount;

    const toggleExpanded = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsExpanded(!isExpanded);
    };

    const iconName = CATEGORY_ICONS[category.id] || 'ellipsis-horizontal-outline';

    const handleDragEnd = ({ data }: { data: ShoppingListItem[] }) => {
        if (onReorderItems) {
            onReorderItems(data);
        }
    };

    const renderItem = ({ item, drag, isActive }: RenderItemParams<ShoppingListItem>) => (
        <DraggableShoppingListItem
            item={item}
            drag={drag}
            isActive={isActive}
            onCheck={() => onCheckItem(item.id, !item.isChecked)}
            onDelete={() => onDeleteItem(item.id)}
            onPress={() => onPressItem(item.id)}
            onQuantityChange={onQuantityChange ? (qty) => onQuantityChange(item.id, qty) : undefined}
        />
    );

    return (
        <View className="mb-md">
            <TouchableOpacity
                onPress={toggleExpanded}
                activeOpacity={0.7}
                className="flex-row items-center justify-between py-sm px-md bg-primary-lightest rounded-lg"
                accessibilityRole="button"
                accessibilityLabel={`${category.localizedName}, ${checkedCount} of ${totalCount} items`}
            >
                <View className="flex-row items-center flex-1">
                    <View className="w-8 h-8 rounded-full bg-primary-light items-center justify-center mr-sm">
                        <Ionicons name={iconName as any} size={18} color={COLORS.primary.darkest} />
                    </View>
                    <Text preset="subheading" className={`flex-1 ${allChecked ? 'text-text-secondary' : 'text-text-default'}`}>
                        {category.localizedName}
                    </Text>
                </View>
                <View className="flex-row items-center">
                    <Text preset="caption" className="text-text-secondary mr-sm">{checkedCount}/{totalCount}</Text>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.grey.medium} />
                </View>
            </TouchableOpacity>

            {isExpanded && (
                <View className="mt-xs">
                    {/* Draggable unchecked items */}
                    {uncheckedItems.length > 0 && (
                        <DraggableFlatList
                            data={uncheckedItems}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            onDragEnd={handleDragEnd}
                            activationDistance={10}
                        />
                    )}

                    {/* Non-draggable checked items */}
                    {checkedItems.map(item => (
                        <ShoppingListItemRow
                            key={item.id}
                            item={item}
                            onCheck={() => onCheckItem(item.id, !item.isChecked)}
                            onDelete={() => onDeleteItem(item.id)}
                            onPress={() => onPressItem(item.id)}
                            onQuantityChange={onQuantityChange ? (qty) => onQuantityChange(item.id, qty) : undefined}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}

export default CategorySection;
