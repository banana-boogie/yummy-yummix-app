import React from 'react';
import { View, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Text, OfflineBanner, AlertModal } from '@/components/common';
import { CategorySection, AddItemModal, FloatingActionBar } from '@/components/shopping-list';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
import { useShoppingListData } from '@/hooks/useShoppingListData';
import { useSelectionMode } from '@/hooks/useSelectionMode';
import { useBatchActions } from '@/hooks/useBatchActions';

export default function ShoppingListDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [modalVisible, setModalVisible] = React.useState(false);

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
        fetchList,
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
        handleBatchCheck,
        handleBatchUncheck,
        handleBatchDeleteRequest,
        handleBatchDeleteConfirm,
        handleClearCheckedItems,
    } = useBatchActions({
        list,
        setList,
        selectedItems,
        clearSelection,
        isOffline,
        queueMutation,
        fetchList,
    });

    if (loading) {
        return (
            <View className="flex-1 bg-background-primary justify-center items-center">
                <Text>{i18n.t('common.loading')}</Text>
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
                                onPress={handleClearCheckedItems}
                                className="mr-md"
                                disabled={isClearingChecked}
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
                            <TouchableOpacity onPress={handleConsolidate} className="mr-md">
                                <Ionicons name="git-merge-outline" size={24} color={COLORS.primary.default} />
                            </TouchableOpacity>
                        )}
                        {/* Select mode toggle */}
                        <TouchableOpacity
                            onPress={toggleSelectMode}
                            disabled={isAnyBatchOperationInProgress}
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
                <View className="h-2 bg-grey-light rounded-full overflow-hidden">
                    <View
                        className="h-full bg-status-success rounded-full"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </View>
            </View>

            {/* Search Bar */}
            <View className="px-md pb-sm">
                <View className="flex-row items-center bg-grey-lightest rounded-lg px-sm py-xs">
                    <Ionicons name="search" size={18} color={COLORS.grey.medium} />
                    <TextInput
                        className="flex-1 ml-sm py-xs text-text-default"
                        placeholder={i18n.t('shoppingList.searchItems')}
                        placeholderTextColor={COLORS.grey.medium}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color={COLORS.grey.medium} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <FlatList
                data={filteredCategories}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <CategorySection
                        category={item}
                        onCheckItem={handleCheckItem}
                        onDeleteItem={handleDeleteItem}
                        onPressItem={(itemId) => { /* TODO: Edit item */ }}
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
            />

            {/* FAB for adding items */}
            <View className="absolute bottom-lg right-lg">
                <TouchableOpacity
                    onPress={() => setModalVisible(true)}
                    className="w-14 h-14 rounded-full bg-primary-default items-center justify-center shadow-lg"
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
        </View>
    );
}
