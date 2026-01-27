import React, { useRef, useMemo } from 'react';
import { View, TouchableOpacity, Animated, PanResponder } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/common';
import { ShoppingListItem } from '@/types/shopping-list.types';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

interface ShoppingListItemRowProps {
    item: ShoppingListItem;
    onCheck: () => void;
    onDelete: () => void;
    onPress: () => void;
    onQuantityChange?: (quantity: number) => void;
    isSelectMode?: boolean;
    isSelected?: boolean;
}

export const ShoppingListItemRow = React.memo(function ShoppingListItemRow({
    item,
    onCheck,
    onDelete,
    onPress,
    onQuantityChange,
    isSelectMode = false,
    isSelected = false,
}: ShoppingListItemRowProps) {
    const translateX = useRef(new Animated.Value(0)).current;
    const SWIPE_THRESHOLD = -80;
    const DELETE_THRESHOLD = -120;

    const panResponder = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
            // Only respond to horizontal swipes
            return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
        },
        onPanResponderMove: (_, gestureState) => {
            // Only allow left swipe (negative dx)
            if (gestureState.dx < 0) {
                translateX.setValue(gestureState.dx);
            }
        },
        onPanResponderRelease: (_, gestureState) => {
            if (gestureState.dx < DELETE_THRESHOLD) {
                // Swipe far enough to delete
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                Animated.timing(translateX, {
                    toValue: -400,
                    duration: 200,
                    useNativeDriver: true,
                }).start(() => {
                    onDelete();
                    translateX.setValue(0);
                });
            } else if (gestureState.dx < SWIPE_THRESHOLD) {
                // Show delete button
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Animated.spring(translateX, {
                    toValue: SWIPE_THRESHOLD,
                    useNativeDriver: true,
                    tension: 100,
                    friction: 8,
                }).start();
            } else {
                // Return to original position
                Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 100,
                    friction: 8,
                }).start();
            }
        },
    }), [translateX, onDelete]);

    const handleCheck = async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onCheck();
    };

    const handleDelete = async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Animated.timing(translateX, {
            toValue: -400,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            onDelete();
            translateX.setValue(0);
        });
    };

    const handleQuantityChange = async (increment: boolean) => {
        if (!onQuantityChange) return;

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newQuantity = increment ? item.quantity + 1 : Math.max(0.5, item.quantity - 1);
        onQuantityChange(newQuantity);
    };

    const displayQuantity = () => {
        const qty = item.quantity;
        const unit = item.unit?.symbol || '';

        // Format quantity nicely
        const formattedQty = qty % 1 === 0 ? qty.toString() : qty.toFixed(1);

        return `${formattedQty} ${unit}`.trim();
    };

    // Determine checkbox state based on mode
    const checkboxState = isSelectMode
        ? (isSelected ? 'selected' : 'unselected')
        : (item.isChecked ? 'checked' : 'unchecked');

    return (
        <View className="mb-xs">
            {/* Delete button background - hidden in select mode */}
            {!isSelectMode && (
                <View className="absolute right-0 top-0 bottom-0 flex-row items-center justify-end pr-md">
                    <TouchableOpacity
                        onPress={handleDelete}
                        className="bg-status-error px-lg py-md rounded-lg flex-row items-center"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="trash-outline" size={20} color={COLORS.neutral.white} />
                        <Text preset="body" className="text-white ml-sm font-semibold">
                            {i18n.t('common.delete')}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Swipeable item content - disable swipe in select mode */}
            <Animated.View
                style={{ transform: [{ translateX: isSelectMode ? 0 : translateX }] }}
                {...(isSelectMode ? {} : panResponder.panHandlers)}
            >
                <View className={`bg-white rounded-lg px-md py-sm flex-row items-center ${item.isChecked && !isSelectMode ? 'opacity-60' : ''} ${isSelected ? 'bg-primary-lightest' : ''}`}>
                    {/* Checkbox / Selection indicator */}
                    <TouchableOpacity
                        onPress={handleCheck}
                        className="mr-sm"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
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

                    {/* Item image */}
                    {item.pictureUrl && (
                        <View className="w-12 h-12 rounded-sm overflow-hidden mr-sm bg-grey-light">
                            <Image
                                source={{ uri: item.pictureUrl }}
                                style={{ width: 48, height: 48 }}
                                contentFit="cover"
                                transition={200}
                            />
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
                    {onQuantityChange && !item.isChecked && (
                        <View className="flex-row items-center bg-grey-light rounded-lg">
                            <TouchableOpacity
                                onPress={() => handleQuantityChange(false)}
                                className="px-sm py-xs"
                                activeOpacity={0.7}
                                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                            >
                                <Ionicons name="remove" size={18} color={COLORS.primary.darkest} />
                            </TouchableOpacity>
                            <View className="w-px h-4 bg-grey-medium" />
                            <TouchableOpacity
                                onPress={() => handleQuantityChange(true)}
                                className="px-sm py-xs"
                                activeOpacity={0.7}
                                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                            >
                                <Ionicons name="add" size={18} color={COLORS.primary.darkest} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Chevron for details */}
                    {!onQuantityChange && (
                        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
                            <Ionicons name="chevron-forward" size={18} color={COLORS.grey.medium} />
                        </TouchableOpacity>
                    )}
                </View>
            </Animated.View>
        </View>
    );
});
