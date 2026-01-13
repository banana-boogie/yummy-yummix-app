import React, { useState } from 'react';
import { View, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Text } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { ShoppingCategoryWithItems, CATEGORY_ICONS } from '@/types/shopping-list.types';
import { ShoppingListItemRow } from './ShoppingListItem';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CategorySectionProps {
    category: ShoppingCategoryWithItems;
    onCheckItem: (itemId: string, isChecked: boolean) => void;
    onDeleteItem: (itemId: string) => void;
    onPressItem: (itemId: string) => void;
    onQuantityChange?: (itemId: string, quantity: number) => void;
    defaultExpanded?: boolean;
}

export function CategorySection({ category, onCheckItem, onDeleteItem, onPressItem, onQuantityChange, defaultExpanded = true }: CategorySectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const checkedCount = category.items.filter(item => item.isChecked).length;
    const totalCount = category.items.length;
    const allChecked = totalCount > 0 && checkedCount === totalCount;

    const toggleExpanded = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsExpanded(!isExpanded);
    };

    const iconName = CATEGORY_ICONS[category.id] || 'ellipsis-horizontal-outline';

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
                    {category.items.map(item => (
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
