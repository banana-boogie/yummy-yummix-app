import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { Text } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { ShoppingCategoryWithItems, ShoppingListItem, CATEGORY_ICONS } from '@/types/shopping-list.types';
import { ShoppingListItemRow } from './ShoppingListItem';
import { DraggableShoppingListItem } from './DraggableShoppingListItem';
import i18n from '@/i18n';

// Wrapper to avoid inline closures per checked item in the .map() render
const CheckedItemRow = React.memo(function CheckedItemRow({
    item,
    onCheckItem,
    onDeleteItem,
    onPressItem,
    onQuantityChange,
    isSelectMode,
    onToggleSelection,
    selectedItems,
}: {
    item: ShoppingListItem;
    onCheckItem: (itemId: string, isChecked: boolean) => void;
    onDeleteItem: (itemId: string) => void;
    onPressItem: (itemId: string) => void;
    onQuantityChange?: (itemId: string, quantity: number) => void;
    isSelectMode: boolean;
    onToggleSelection?: (itemId: string) => void;
    selectedItems?: Set<string>;
}) {
    const handleCheck = useCallback(() => {
        if (isSelectMode && onToggleSelection) {
            onToggleSelection(item.id);
        } else {
            onCheckItem(item.id, !item.isChecked);
        }
    }, [isSelectMode, onToggleSelection, onCheckItem, item.id, item.isChecked]);

    const handleDelete = useCallback(() => onDeleteItem(item.id), [onDeleteItem, item.id]);

    const handlePress = useCallback(() => {
        if (isSelectMode && onToggleSelection) {
            onToggleSelection(item.id);
        } else {
            onPressItem(item.id);
        }
    }, [isSelectMode, onToggleSelection, onPressItem, item.id]);

    const handleQuantityChange = useCallback(
        (qty: number) => onQuantityChange?.(item.id, qty),
        [onQuantityChange, item.id]
    );

    return (
        <ShoppingListItemRow
            item={item}
            onCheck={handleCheck}
            onDelete={handleDelete}
            onPress={handlePress}
            onQuantityChange={isSelectMode ? undefined : (onQuantityChange ? handleQuantityChange : undefined)}
            isSelectMode={isSelectMode}
            isSelected={selectedItems?.has(item.id)}
        />
    );
});

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
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    // Selection mode props
    isSelectMode?: boolean;
    selectedItems?: Set<string>;
    onToggleSelection?: (itemId: string) => void;
    onSelectAllInCategory?: (itemIds: string[]) => void;
}

export const CategorySection = React.memo(function CategorySection({ category, onCheckItem, onDeleteItem, onPressItem, onQuantityChange, onReorderItems, defaultExpanded = true, isExpanded: controlledExpanded, onToggleExpand, isSelectMode = false, selectedItems, onToggleSelection, onSelectAllInCategory }: CategorySectionProps) {
    const [localExpanded, setLocalExpanded] = useState(defaultExpanded);

    // Use controlled state if provided, otherwise use local state
    const isExpanded = controlledExpanded !== undefined ? controlledExpanded : localExpanded;

    // Separate unchecked and checked items
    const uncheckedItems = category.items.filter(item => !item.isChecked);
    const checkedItems = category.items.filter(item => item.isChecked);

    const checkedCount = checkedItems.length;
    const totalCount = category.items.length;
    const allChecked = totalCount > 0 && checkedCount === totalCount;

    const toggleExpanded = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (onToggleExpand) {
            onToggleExpand();
        } else {
            setLocalExpanded(!localExpanded);
        }
    };

    const handleHeaderPress = () => {
        if (isSelectMode && onSelectAllInCategory) {
            // In select mode, toggle selection of all items in this category
            const allItemIds = category.items.map(item => item.id);
            onSelectAllInCategory(allItemIds);
        } else {
            toggleExpanded();
        }
    };

    // Check if all items in category are selected
    const allItemsSelected = isSelectMode && category.items.length > 0 &&
        category.items.every(item => selectedItems?.has(item.id));

    const iconName = CATEGORY_ICONS[category.id] || 'ellipsis-horizontal-outline';

    const handleDragEnd = ({ data }: { data: ShoppingListItem[] }) => {
        if (onReorderItems) {
            onReorderItems(data);
        }
    };

    const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<ShoppingListItem>) => (
        <DraggableShoppingListItem
            item={item}
            drag={isSelectMode ? undefined : drag}
            isActive={isActive}
            onCheck={() => {
                if (isSelectMode && onToggleSelection) {
                    onToggleSelection(item.id);
                } else {
                    onCheckItem(item.id, !item.isChecked);
                }
            }}
            onDelete={() => onDeleteItem(item.id)}
            onPress={() => {
                if (isSelectMode && onToggleSelection) {
                    onToggleSelection(item.id);
                } else {
                    onPressItem(item.id);
                }
            }}
            onQuantityChange={isSelectMode ? undefined : (onQuantityChange ? (qty) => onQuantityChange(item.id, qty) : undefined)}
            isSelectMode={isSelectMode}
            isSelected={selectedItems?.has(item.id)}
        />
    ), [isSelectMode, onToggleSelection, onCheckItem, onDeleteItem, onPressItem, onQuantityChange, selectedItems]);

    return (
        <View className="mb-md">
            <TouchableOpacity
                onPress={handleHeaderPress}
                activeOpacity={0.7}
                className={`flex-row items-center justify-between py-sm px-md rounded-lg ${
                    isSelectMode && allItemsSelected ? 'bg-primary-light' : 'bg-primary-lightest'
                }`}
                accessibilityRole="button"
                accessibilityLabel={i18n.t('shoppingList.accessibility.categorySummary', {
                    category: category.localizedName,
                    checked: checkedCount,
                    total: totalCount,
                })}
            >
                <View className="flex-row items-center flex-1">
                    {isSelectMode ? (
                        // Show checkbox in select mode
                        <View className={`w-8 h-8 rounded-full items-center justify-center mr-sm ${
                            allItemsSelected ? 'bg-primary-default' : 'bg-primary-light'
                        }`}>
                            <Ionicons
                                name={allItemsSelected ? 'checkmark' : 'ellipsis-horizontal'}
                                size={18}
                                color={allItemsSelected ? COLORS.neutral.white : COLORS.primary.darkest}
                            />
                        </View>
                    ) : (
                        <View className="w-8 h-8 rounded-full bg-primary-light items-center justify-center mr-sm">
                            <Ionicons name={iconName as any} size={18} color={COLORS.primary.darkest} />
                        </View>
                    )}
                    <Text preset="subheading" className={`flex-1 ${allChecked ? 'text-text-secondary' : 'text-text-default'}`}>
                        {category.localizedName}
                    </Text>
                </View>
                <View className="flex-row items-center">
                    {isSelectMode ? (
                        <Text preset="caption" className="text-text-secondary mr-sm">
                            {category.items.filter(item => selectedItems?.has(item.id)).length}/{totalCount}
                        </Text>
                    ) : (
                        <Text preset="caption" className="text-text-secondary mr-sm">{checkedCount}/{totalCount}</Text>
                    )}
                    {!isSelectMode && (
                        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.grey.medium} />
                    )}
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
                        <CheckedItemRow
                            key={item.id}
                            item={item}
                            onCheckItem={onCheckItem}
                            onDeleteItem={onDeleteItem}
                            onPressItem={onPressItem}
                            onQuantityChange={onQuantityChange}
                            isSelectMode={isSelectMode}
                            onToggleSelection={onToggleSelection}
                            selectedItems={selectedItems}
                        />
                    ))}
                </View>
            )}
        </View>
    );
});

export default CategorySection;
