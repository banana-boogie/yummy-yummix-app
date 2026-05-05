import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, TextInput, Animated, Keyboard, ActionSheetIOS, Platform, Modal } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Text, OfflineBanner, AlertModal } from '@/components/common';
import { CategorySection, AddItemModal, EditItemModal, FloatingActionBar } from '@/components/shopping-list';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '@/constants/design-tokens';
import i18n from '@/i18n';
import { ShoppingListItem } from '@/types/shopping-list.types';
import { shoppingListService } from '@/services/shoppingListService';
import { useShoppingListData } from '@/hooks/useShoppingListData';
import { useSelectionMode } from '@/hooks/useSelectionMode';
import { useBatchActions } from '@/hooks/useBatchActions';

// Skeleton loading component
function SkeletonLoader() {
    const pulseAnim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [pulseAnim]);

    const SkeletonItem = () => (
        <Animated.View
            style={{ opacity: pulseAnim }}
            className="bg-grey-light rounded-lg h-16 mb-xs"
        />
    );

    const SkeletonCategory = () => (
        <View className="mb-md">
            <Animated.View
                style={{ opacity: pulseAnim }}
                className="bg-grey-light rounded-lg h-10 mb-xs"
            />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
        </View>
    );

    return (
        <View className="px-md">
            {/* Progress skeleton */}
            <View className="pt-md pb-sm">
                <Animated.View
                    style={{ opacity: pulseAnim }}
                    className="bg-grey-light rounded h-4 w-32 mb-xs"
                />
                <Animated.View
                    style={{ opacity: pulseAnim }}
                    className="bg-grey-light rounded-full h-2"
                />
            </View>
            {/* Search skeleton */}
            <View className="pb-sm">
                <Animated.View
                    style={{ opacity: pulseAnim }}
                    className="bg-grey-light rounded-lg h-10"
                />
            </View>
            {/* Categories skeleton */}
            <SkeletonCategory />
            <SkeletonCategory />
        </View>
    );
}

// Empty state component
function EmptyState() {
    return (
        <View className="flex-1 items-center justify-center py-xl">
            <View className="w-20 h-20 rounded-full bg-status-success/10 items-center justify-center mb-md">
                <Ionicons name="checkmark-circle" size={48} color={COLORS.status.success} />
            </View>
            <Text preset="h3" className="text-text-default mb-xs">
                {i18n.t('shoppingList.allDone')}
            </Text>
            <Text preset="body" className="text-text-secondary text-center px-lg">
                {i18n.t('shoppingList.allDoneDescription')}
            </Text>
        </View>
    );
}

// Animated progress bar component
function AnimatedProgressBar({ percentage }: { percentage: number }) {
    const widthAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(widthAnim, {
            toValue: percentage,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [percentage, widthAnim]);

    return (
        <View className="h-2 bg-grey-light rounded-full overflow-hidden">
            <Animated.View
                className="h-full bg-status-success rounded-full"
                style={{
                    width: widthAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                    }),
                }}
            />
        </View>
    );
}

export default function ShoppingListDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null);
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [prefilledAddName, setPrefilledAddName] = useState<string | undefined>(undefined);
    const [actionSheetItemId, setActionSheetItemId] = useState<string | null>(null);
    const searchInputRef = useRef<TextInput>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Warm the ingredient catalogue cache on mount so AddItemModal opens with
    // suggestions ready — fire-and-forget, errors fall back to network search.
    useEffect(() => {
        shoppingListService.getAllIngredients().catch(() => { /* best effort */ });
    }, []);

    // Shopping list data and operations
    const {
        list,
        categories,
        loading,
        filteredCategories,
        searchQuery,
        setSearchQuery,
        collapsedCategories,
        toggleCategoryCollapse,
        progressPercentage,
        handleCheckItem,
        handleDeleteItem,
        handleAddItem,
        handleEditItem,
        setList,
        isOffline,
        isSyncing,
        pendingCount,
        queueMutation,
    } = useShoppingListData({ listId: id });

    // Selection mode
    const {
        isSelectMode,
        selectedItems,
        selectedItemsInfo,
        toggleSelectMode,
        toggleItemSelection,
        handleSelectAll,
        handleDeselectAll,
        handleSelectAllInCategory,
        clearSelection,
    } = useSelectionMode({ listId: id, categories: list?.categories });

    // Batch actions
    const {
        isBatchChecking,
        isBatchUnchecking,
        isBatchDeleting,
        isAnyBatchOperationInProgress,
        showDeleteConfirm,
        setShowDeleteConfirm,
        handleBatchCheck,
        handleBatchUncheck,
        handleBatchDeleteRequest,
        handleBatchDeleteConfirm,
    } = useBatchActions({
        list,
        setList,
        selectedItems,
        clearSelection,
        isOffline,
        queueMutation,
        categories,
    });

    // Debounced search input
    const handleSearchChange = useCallback((text: string) => {
        setDebouncedSearchQuery(text);

        // Clear existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Set new debounced timer (200ms)
        debounceTimerRef.current = setTimeout(() => {
            setSearchQuery(text);
        }, 200);
    }, [setSearchQuery]);

    // Cleanup debounce timer
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    // Dismiss keyboard on scroll
    const handleScrollBeginDrag = useCallback(() => {
        Keyboard.dismiss();
    }, []);

    // Tap a row → open the edit modal for that item.
    const handlePressItem = useCallback((itemId: string) => {
        if (!list) return;
        const found = list.items.find(i => i.id === itemId);
        if (found) setEditingItem(found);
    }, [list]);

    // Long-press a row → enter select mode and pre-select that row.
    const handleLongPressItem = useCallback((itemId: string) => {
        if (!isSelectMode) {
            toggleSelectMode();
        }
        toggleItemSelection(itemId);
    }, [isSelectMode, toggleSelectMode, toggleItemSelection]);

    // ⋯ icon on a row → open action sheet (Edit / Delete).
    const openItemActions = useCallback((itemId: string) => {
        if (!list) return;
        const item = list.items.find(i => i.id === itemId);
        if (!item) return;

        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: [
                        i18n.t('common.cancel'),
                        i18n.t('shoppingList.editItem'),
                        i18n.t('shoppingList.deleteItem'),
                    ],
                    destructiveButtonIndex: 2,
                    cancelButtonIndex: 0,
                    title: item.name,
                },
                (index) => {
                    if (index === 1) setEditingItem(item);
                    else if (index === 2) handleDeleteItem(itemId);
                }
            );
        } else {
            // Android fallback — render a Modal with two buttons (see below).
            setActionSheetItemId(itemId);
        }
    }, [list, handleDeleteItem]);

    const handleEditSave = useCallback(async (updates: Parameters<typeof handleEditItem>[1]) => {
        if (!editingItem) return;
        await handleEditItem(editingItem.id, updates);
    }, [editingItem, handleEditItem]);

    const handleEditDelete = useCallback(() => {
        if (!editingItem) return;
        handleDeleteItem(editingItem.id);
    }, [editingItem, handleDeleteItem]);

    // Filter input "Add as new" affordance — open AddItemModal with the typed
    // name pre-filled so the user can continue without re-typing.
    const handleAddFromFilter = useCallback(() => {
        const typed = debouncedSearchQuery.trim();
        if (!typed) return;
        setPrefilledAddName(typed);
        setDebouncedSearchQuery('');
        setSearchQuery('');
        setModalVisible(true);
    }, [debouncedSearchQuery, setSearchQuery]);

    // Extract contentContainerStyle to avoid object re-creation
    const listContentContainerStyle = useMemo(() => ({
        padding: SPACING.md,
        paddingBottom: SPACING.xxxxl,
    }), []);

    if (loading) {
        return (
            <View className="flex-1 bg-background-primary">
                <Stack.Screen options={{ title: i18n.t('common.loading') }} />
                <SkeletonLoader />
            </View>
        );
    }

    if (!list) {
        return (
            <View className="flex-1 bg-background-primary justify-center items-center">
                <Text>{i18n.t('shoppingList.listNotFound')}</Text>
            </View>
        );
    }

    const isEmpty = list.itemCount === 0;

    return (
        <View className="flex-1 bg-background-primary">
            {/* Offline banner */}
            <OfflineBanner
                isOffline={isOffline}
                isSyncing={isSyncing}
                pendingCount={pendingCount}
            />

            <Stack.Screen options={{
                title: isSelectMode
                    ? i18n.t('shoppingList.selectMode', { count: selectedItems.size })
                    : list.name,
                headerRight: () => (
                    // In select mode: cancel button replaces all header actions.
                    // Out of select mode: no header right action — long-press a row to enter select mode.
                    isSelectMode ? (
                        <TouchableOpacity
                            onPress={toggleSelectMode}
                            disabled={isAnyBatchOperationInProgress}
                            accessibilityLabel={i18n.t('shoppingList.exitSelectMode')}
                            accessibilityRole="button"
                        >
                            <Text preset="body" className="text-text-default font-medium">
                                {i18n.t('common.cancel')}
                            </Text>
                        </TouchableOpacity>
                    ) : null
                )
            }} />

            {/* Progress Indicator */}
            <View className="px-md pt-md pb-sm">
                <View className="flex-row items-center justify-between mb-xs">
                    <Text preset="caption" className="text-text-secondary">
                        {i18n.t('shoppingList.progress', {
                            checked: list.checkedCount,
                            total: list.itemCount
                        })}
                    </Text>
                    <Text preset="caption" className="text-text-secondary font-semibold">
                        {progressPercentage}%
                    </Text>
                </View>
                <AnimatedProgressBar percentage={progressPercentage} />
            </View>

            {/* Filter-or-add bar */}
            <View className="px-md pb-sm">
                <View className="flex-row items-center bg-grey-lightest rounded-lg px-sm py-xs">
                    <TextInput
                        ref={searchInputRef}
                        className="flex-1 ml-sm py-xs text-text-default"
                        placeholder={i18n.t('shoppingList.filterOrAddPlaceholder')}
                        placeholderTextColor={COLORS.grey.medium}
                        value={debouncedSearchQuery}
                        onChangeText={handleSearchChange}
                        autoCorrect={false}
                        returnKeyType="done"
                        onSubmitEditing={() => {
                            // Pressing Enter in the filter always opens AddItemModal pre-filled,
                            // even if the typed text matches existing items — lets users add a
                            // duplicate (different unit/notes) without going through the FAB.
                            const typed = debouncedSearchQuery.trim();
                            if (typed) {
                                setPrefilledAddName(typed);
                                setDebouncedSearchQuery('');
                                setSearchQuery('');
                                setModalVisible(true);
                            }
                            Keyboard.dismiss();
                        }}
                        accessibilityLabel={i18n.t('shoppingList.filterOrAddPlaceholder')}
                    />
                    {debouncedSearchQuery.length > 0 && (
                        <TouchableOpacity
                            onPress={() => {
                                setDebouncedSearchQuery('');
                                setSearchQuery('');
                            }}
                            accessibilityLabel={i18n.t('common.clear')}
                        >
                            <Ionicons name="close-circle" size={18} color={COLORS.grey.medium} />
                        </TouchableOpacity>
                    )}
                </View>
                {/* Inline "+ Add 'foo' as new" affordance: only when typed, no matches, not in select mode. */}
                {!isSelectMode && debouncedSearchQuery.trim().length >= 2 && filteredCategories.length === 0 && (
                    <TouchableOpacity
                        onPress={handleAddFromFilter}
                        className="flex-row items-center px-sm py-sm mt-xs rounded-lg bg-primary-lightest"
                        accessibilityRole="button"
                    >
                        <Ionicons name="add-circle" size={20} color={COLORS.primary.darkest} />
                        <Text preset="body" className="ml-sm text-primary-darkest">
                            {i18n.t('shoppingList.addAsNew', { query: debouncedSearchQuery.trim() })}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {isEmpty ? (
                <EmptyState />
            ) : (
                <FlatList
                    data={filteredCategories}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <CategorySection
                            category={item}
                            onCheckItem={handleCheckItem}
                            onPressItem={handlePressItem}
                            onLongPressItem={handleLongPressItem}
                            onMoreItem={openItemActions}
                            isExpanded={!collapsedCategories.has(item.id)}
                            onToggleExpand={() => toggleCategoryCollapse(item.id)}
                            isSelectMode={isSelectMode}
                            selectedItems={selectedItems}
                            onToggleSelection={toggleItemSelection}
                            onSelectAllInCategory={handleSelectAllInCategory}
                        />
                    )}
                    contentContainerStyle={listContentContainerStyle}
                    onScrollBeginDrag={handleScrollBeginDrag}
                    keyboardShouldPersistTaps="handled"
                />
            )}

            {/* FAB for adding items */}
            <View className="absolute bottom-lg right-lg">
                <TouchableOpacity
                    onPress={() => setModalVisible(true)}
                    className="w-14 h-14 rounded-full bg-primary-default items-center justify-center shadow-lg"
                    accessibilityLabel={i18n.t('shoppingList.addItem')}
                    accessibilityRole="button"
                >
                    <Ionicons name="add" size={32} color="white" />
                </TouchableOpacity>
            </View>

            <AddItemModal
                visible={modalVisible}
                onClose={() => {
                    setModalVisible(false);
                    setPrefilledAddName(undefined);
                }}
                onAddItem={handleAddItem}
                categories={categories}
                initialName={prefilledAddName}
            />

            <EditItemModal
                visible={!!editingItem}
                onClose={() => setEditingItem(null)}
                item={editingItem}
                categories={categories}
                onSave={handleEditSave}
                onDelete={handleEditDelete}
            />

            {/* Floating action bar for batch operations */}
            {isSelectMode && selectedItems.size > 0 && (
                <FloatingActionBar
                    selectedCount={selectedItems.size}
                    totalCount={list.itemCount}
                    onCheckAll={handleBatchCheck}
                    onUncheckAll={handleBatchUncheck}
                    onDeleteAll={handleBatchDeleteRequest}
                    onCancel={toggleSelectMode}
                    onSelectAll={handleSelectAll}
                    onDeselectAll={handleDeselectAll}
                    hasCheckedItems={selectedItemsInfo.hasChecked}
                    hasUncheckedItems={selectedItemsInfo.hasUnchecked}
                    isCheckingAll={isBatchChecking}
                    isUncheckingAll={isBatchUnchecking}
                    isDeletingAll={isBatchDeleting}
                    disabled={isAnyBatchOperationInProgress}
                />
            )}

            {/* Batch delete confirmation modal */}
            <AlertModal
                visible={showDeleteConfirm}
                title={i18n.t('common.delete')}
                message={i18n.t('shoppingList.batchDeleteConfirm', { count: selectedItems.size })}
                confirmText={i18n.t('common.delete')}
                cancelText={i18n.t('common.cancel')}
                isDestructive={true}
                onConfirm={handleBatchDeleteConfirm}
                onCancel={() => setShowDeleteConfirm(false)}
            />

            {/* Android action sheet fallback (iOS uses ActionSheetIOS). */}
            {Platform.OS !== 'ios' && (
                <Modal
                    visible={actionSheetItemId !== null}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setActionSheetItemId(null)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => setActionSheetItemId(null)}
                        className="flex-1 justify-end bg-black/40"
                    >
                        <View className="bg-neutral-white rounded-t-xl p-md">
                            <TouchableOpacity
                                onPress={() => {
                                    const id = actionSheetItemId;
                                    setActionSheetItemId(null);
                                    if (!id || !list) return;
                                    const found = list.items.find(i => i.id === id);
                                    if (found) setEditingItem(found);
                                }}
                                className="py-md"
                                accessibilityRole="button"
                            >
                                <Text preset="body" className="text-text-default text-center">
                                    {i18n.t('shoppingList.editItem')}
                                </Text>
                            </TouchableOpacity>
                            <View className="h-px bg-grey-lightest" />
                            <TouchableOpacity
                                onPress={() => {
                                    const id = actionSheetItemId;
                                    setActionSheetItemId(null);
                                    if (id) handleDeleteItem(id);
                                }}
                                className="py-md"
                                accessibilityRole="button"
                            >
                                <Text preset="body" className="text-center" style={{ color: COLORS.status.error }}>
                                    {i18n.t('shoppingList.deleteItem')}
                                </Text>
                            </TouchableOpacity>
                            <View className="h-px bg-grey-lightest" />
                            <TouchableOpacity
                                onPress={() => setActionSheetItemId(null)}
                                className="py-md"
                                accessibilityRole="button"
                            >
                                <Text preset="body" className="text-text-secondary text-center">
                                    {i18n.t('common.cancel')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>
            )}
        </View>
    );
}
