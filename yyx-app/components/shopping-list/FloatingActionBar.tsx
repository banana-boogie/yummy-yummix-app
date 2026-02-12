import React from 'react';
import { View, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { Text } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import i18n from '@/i18n';

interface FloatingActionBarProps {
    selectedCount: number;
    totalCount: number;
    onCheckAll: () => void;
    onUncheckAll: () => void;
    onDeleteAll: () => void;
    onCancel: () => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    hasCheckedItems: boolean;
    hasUncheckedItems: boolean;
    // Loading states
    isCheckingAll?: boolean;
    isUncheckingAll?: boolean;
    isDeletingAll?: boolean;
    disabled?: boolean;
}

export const FloatingActionBar = React.memo(function FloatingActionBar({
    selectedCount,
    totalCount,
    onCheckAll,
    onUncheckAll,
    onDeleteAll,
    onCancel,
    onSelectAll,
    onDeselectAll,
    hasCheckedItems,
    hasUncheckedItems,
    isCheckingAll = false,
    isUncheckingAll = false,
    isDeletingAll = false,
    disabled = false,
}: FloatingActionBarProps) {
    const insets = useSafeAreaInsets();

    const allSelected = selectedCount >= totalCount && totalCount > 0;
    const isAnyLoading = isCheckingAll || isUncheckingAll || isDeletingAll;
    const isDisabled = disabled || isAnyLoading;

    return (
        <Animated.View
            className="absolute left-md right-md bg-white rounded-xl shadow-lg"
            style={{
                bottom: insets.bottom + 100,
                shadowColor: COLORS.shadow.default,
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
            }}
        >
            {/* Header with count and cancel */}
            <View className="flex-row items-center justify-between px-md py-sm border-b border-grey-lightest">
                <Text preset="body" className="text-text-default font-semibold">
                    {i18n.t('shoppingList.selectMode', { count: selectedCount })}
                </Text>
                <TouchableOpacity
                    onPress={onCancel}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                    disabled={isAnyLoading}
                >
                    <Ionicons name="close" size={24} color={isAnyLoading ? COLORS.grey.light : COLORS.grey.medium} />
                </TouchableOpacity>
            </View>

            {/* Action buttons */}
            <View className="flex-row items-center justify-around py-sm px-md">
                {/* Select All / Deselect All button */}
                <TouchableOpacity
                    onPress={allSelected ? onDeselectAll : onSelectAll}
                    className={`items-center px-md py-xs ${isDisabled ? 'opacity-50' : ''}`}
                    activeOpacity={0.7}
                    disabled={isDisabled}
                >
                    <View className="w-10 h-10 rounded-full bg-primary-light items-center justify-center mb-xs">
                        <Ionicons
                            name={allSelected ? 'square-outline' : 'checkbox'}
                            size={22}
                            color={COLORS.primary.darkest}
                        />
                    </View>
                    <Text preset="caption" className="text-primary-darkest font-medium">
                        {allSelected
                            ? i18n.t('shoppingList.deselectAll')
                            : i18n.t('shoppingList.selectAll')
                        }
                    </Text>
                </TouchableOpacity>

                {/* Check All button */}
                {hasUncheckedItems && (
                    <TouchableOpacity
                        onPress={onCheckAll}
                        className={`items-center px-md py-xs ${isDisabled ? 'opacity-50' : ''}`}
                        activeOpacity={0.7}
                        disabled={isDisabled}
                    >
                        <View className="w-10 h-10 rounded-full bg-status-success/10 items-center justify-center mb-xs">
                            {isCheckingAll ? (
                                <ActivityIndicator size="small" color={COLORS.status.success} />
                            ) : (
                                <Ionicons name="checkmark-done" size={22} color={COLORS.status.success} />
                            )}
                        </View>
                        <Text preset="caption" className="text-status-success font-medium">
                            {i18n.t('shoppingList.batchCheck')}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Uncheck All button */}
                {hasCheckedItems && (
                    <TouchableOpacity
                        onPress={onUncheckAll}
                        className={`items-center px-md py-xs ${isDisabled ? 'opacity-50' : ''}`}
                        activeOpacity={0.7}
                        disabled={isDisabled}
                    >
                        <View className="w-10 h-10 rounded-full bg-grey-light items-center justify-center mb-xs">
                            {isUncheckingAll ? (
                                <ActivityIndicator size="small" color={COLORS.grey.dark} />
                            ) : (
                                <Ionicons name="refresh" size={22} color={COLORS.grey.dark} />
                            )}
                        </View>
                        <Text preset="caption" className="text-grey-dark font-medium">
                            {i18n.t('shoppingList.batchUncheck')}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Delete All button */}
                <TouchableOpacity
                    onPress={onDeleteAll}
                    className={`items-center px-md py-xs ${isDisabled ? 'opacity-50' : ''}`}
                    activeOpacity={0.7}
                    disabled={isDisabled}
                >
                    <View className="w-10 h-10 rounded-full bg-status-error/10 items-center justify-center mb-xs">
                        {isDeletingAll ? (
                            <ActivityIndicator size="small" color={COLORS.status.error} />
                        ) : (
                            <Ionicons name="trash" size={22} color={COLORS.status.error} />
                        )}
                    </View>
                    <Text preset="caption" className="text-status-error font-medium">
                        {i18n.t('shoppingList.batchDelete')}
                    </Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
});

export default FloatingActionBar;
