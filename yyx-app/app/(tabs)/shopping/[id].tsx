import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, TextInput, Animated, RefreshControl, Keyboard } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Text, OfflineBanner, AlertModal } from '@/components/common';
import { CategorySection, AddItemModal, FloatingActionBar } from '@/components/shopping-list';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
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
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const searchInputRef = useRef<TextInput>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        handleConsolidate,
        handleReorderItems,
        setList,
        isOffline,
        isSyncing,
        pendingCount,
        queueMutation,
        isRefreshing,
        handleRefresh,
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
        isClearingChecked,
        isAnyBatchOperationInProgress,
        showDeleteConfirm,
        setShowDeleteConfirm,
        showClearCheckedConfirm,
        setShowClearCheckedConfirm,
        handleBatchCheck,
        handleBatchUncheck,
        handleBatchDeleteRequest,
        handleBatchDeleteConfirm,
        handleClearCheckedRequest,
        handleClearCheckedConfirm,
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
                title: list.name,
                headerRight: () => (
                    <View className="flex-row items-center">
                        {/* Clear checked items button */}
                        {!isSelectMode && list.checkedCount > 0 && (
                            <TouchableOpacity
                                onPress={handleClearCheckedRequest}
                                className="mr-md"
                                disabled={isClearingChecked}
                                accessibilityLabel={i18n.t('shoppingList.clearChecked')}
                                accessibilityRole="button"
                            >
                                <Ionicons
                                    name="checkmark-done-outline"
                                    size={24}
                                    color={isClearingChecked ? COLORS.grey.light : COLORS.status.success}
                                />
                            </TouchableOpacity>
                        )}
                        {/* Consolidate button */}
                        {!isSelectMode && (
                            <TouchableOpacity
                                onPress={handleConsolidate}
                                className="mr-md"
                                accessibilityLabel={i18n.t('shoppingList.consolidate')}
                                accessibilityRole="button"
                            >
                                <Ionicons name="git-merge-outline" size={24} color={COLORS.primary.default} />
                            </TouchableOpacity>
                        )}
                        {/* Select mode toggle */}
                        <TouchableOpacity
                            onPress={toggleSelectMode}
                            disabled={isAnyBatchOperationInProgress}
                            accessibilityLabel={isSelectMode
                                ? i18n.t('shoppingList.exitSelectMode')
                                : i18n.t('shoppingList.enterSelectMode')
                            }
                            accessibilityRole="button"
                        >
                            <Ionicons
                                name={isSelectMode ? 'close' : 'checkbox-outline'}
                                size={24}
                                color={isSelectMode ? COLORS.grey.dark : COLORS.primary.default}
                            />
                        </TouchableOpacity>
                    </View>
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

            {/* Search Bar */}
            <View className="px-md pb-sm">
                <View className="flex-row items-center bg-grey-lightest rounded-lg px-sm py-xs">
                    <Ionicons name="search" size={18} color={COLORS.grey.medium} />
                    <TextInput
                        ref={searchInputRef}
                        className="flex-1 ml-sm py-xs text-text-default"
                        placeholder={i18n.t('shoppingList.searchItems')}
                        placeholderTextColor={COLORS.grey.medium}
                        value={debouncedSearchQuery}
                        onChangeText={handleSearchChange}
                        autoCorrect={false}
                        returnKeyType="search"
                        onSubmitEditing={() => Keyboard.dismiss()}
                        accessibilityLabel={i18n.t('shoppingList.searchItems')}
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
                            onDeleteItem={handleDeleteItem}
                            onPressItem={() => { /* Item press - no action needed for now */ }}
                            onReorderItems={(items) => handleReorderItems(item.id, items)}
                            isExpanded={!collapsedCategories.has(item.id)}
                            onToggleExpand={() => toggleCategoryCollapse(item.id)}
                            isSelectMode={isSelectMode}
                            selectedItems={selectedItems}
                            onToggleSelection={toggleItemSelection}
                            onSelectAllInCategory={handleSelectAllInCategory}
                        />
                    )}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            tintColor={COLORS.primary.default}
                            colors={[COLORS.primary.default]}
                        />
                    }
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
                onClose={() => setModalVisible(false)}
                onAddItem={handleAddItem}
                categories={categories}
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

            {/* Clear checked confirmation modal */}
            <AlertModal
                visible={showClearCheckedConfirm}
                title={i18n.t('shoppingList.clearChecked')}
                message={i18n.t('shoppingList.clearCheckedConfirm')}
                confirmText={i18n.t('common.delete')}
                cancelText={i18n.t('common.cancel')}
                isDestructive={true}
                onConfirm={handleClearCheckedConfirm}
                onCancel={() => setShowClearCheckedConfirm(false)}
            />
        </View>
    );
}
