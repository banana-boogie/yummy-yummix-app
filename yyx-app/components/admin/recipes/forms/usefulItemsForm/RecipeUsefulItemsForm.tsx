import React, { useState, useEffect, useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Text } from '@/components/common/Text';
import { AdminRecipe, AdminRecipeUsefulItem, AdminUsefulItem } from '@/types/recipe.admin.types';
import i18n from '@/i18n';
import { FormSection } from '@/components/form/FormSection';
import { adminUsefulItemsService } from '@/services/admin/adminUsefulItemsService';
import { SearchBar } from '@/components/common/SearchBar';
import { Button } from '@/components/common/Button';
import { AlertModal } from '@/components/common/AlertModal';
import { v4 as generateUUID } from 'uuid';
import { RecipeUsefulItemFormModal } from './RecipeUsefulItemFormModal';
import { CreateEditUsefulItemModal } from '@/components/admin/useful-items/CreateEditUsefulItemModal';
import { COLORS } from '@/constants/design-tokens';
import { useDevice } from '@/hooks/useDevice';
import { SelectedItemsSection } from './SelectedItemsSection';
import { AvailableItemsSection } from './AvailableItemsSection';

type UsefulItemsFormProps = {
    recipe: AdminRecipe;
    onUpdateRecipe: (updates: Partial<AdminRecipe>) => void;
    errors: Record<string, string>;
};

export function RecipeUsefulItemsForm({ recipe, onUpdateRecipe, errors }: UsefulItemsFormProps) {
    const { isMobile } = useDevice();
    const [usefulItems, setUsefulItems] = useState<AdminUsefulItem[]>([]);
    const [filteredUsefulItems, setFilteredUsefulItems] = useState<AdminUsefulItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRecipeUsefulItem, setSelectedRecipeUsefulItem] = useState<AdminRecipeUsefulItem>();
    const [modalVisible, setModalVisible] = useState(false);
    const [newUsefulItemModalVisible, setNewUsefulItemModalVisible] = useState(false);
    const [showErrorAlert, setShowErrorAlert] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Initialize usefulItems array if it doesn't exist
    useEffect(() => {
        if (!recipe.usefulItems) {
            onUpdateRecipe({ usefulItems: [] });
        }
    }, []);

    // Load all useful items from the API
    useEffect(() => {
        const fetchUsefulItems = async () => {
            try {
                setLoading(true);
                const fetchedUsefulItems = await adminUsefulItemsService.getAllUsefulItems();
                setUsefulItems(fetchedUsefulItems);
                setFilteredUsefulItems(fetchedUsefulItems);
            } catch (error) {
                console.error('Error fetching useful items:', error);
                setErrorMessage(i18n.t('admin.recipes.form.usefulItemsInfo.fetchError'));
                setShowErrorAlert(true);
            } finally {
                setLoading(false);
            }
        };

        fetchUsefulItems();
    }, []);

    // Filter useful items when search query changes
    useEffect(() => {
        if (searchQuery) {
            const lowercaseQuery = searchQuery.toLowerCase();
            const filtered = usefulItems.filter(item =>
                item.nameEn?.toLowerCase().includes(lowercaseQuery) ||
                item.nameEs?.toLowerCase().includes(lowercaseQuery)
            );
            setFilteredUsefulItems(filtered);
        } else {
            setFilteredUsefulItems(usefulItems);
        }
    }, [searchQuery, usefulItems]);

    const handleAddRecipeUsefulItem = (usefulItem: AdminUsefulItem) => {
        const newRecipeUsefulItem: AdminRecipeUsefulItem = {
            id: generateUUID(),
            recipeId: recipe.id || '',
            usefulItemId: usefulItem.id,
            displayOrder: recipe.usefulItems ? recipe.usefulItems.length : 0,
            usefulItem,
        };

        setSelectedRecipeUsefulItem(newRecipeUsefulItem);
        setModalVisible(true);
    };

    const handleEditRecipeUsefulItem = (usefulItem: AdminRecipeUsefulItem) => {
        setSelectedRecipeUsefulItem(usefulItem);
        setModalVisible(true);
    };

    const handleDeleteRecipeUsefulItem = (recipeUsefulItem: AdminRecipeUsefulItem) => {
        const updatedUsefulItems = (recipe.usefulItems || []).filter(
            item => item.id !== recipeUsefulItem.id
        );

        const reorderedUsefulItems = updatedUsefulItems.map((item, index) => ({
            ...item,
            displayOrder: index
        }));

        onUpdateRecipe({ usefulItems: reorderedUsefulItems });
    };

    const handleSaveRecipeUsefulItem = (updatedRecipeUsefulItem: AdminRecipeUsefulItem) => {
        let updatedRecipeUsefulItems: AdminRecipeUsefulItem[] = recipe.usefulItems || [];

        const existingIndex = updatedRecipeUsefulItems.findIndex(
            item => item.id === updatedRecipeUsefulItem.id
        );

        if (existingIndex >= 0) {
            updatedRecipeUsefulItems = [...updatedRecipeUsefulItems];
            updatedRecipeUsefulItems[existingIndex] = updatedRecipeUsefulItem;
        } else {
            updatedRecipeUsefulItems = [...updatedRecipeUsefulItems, updatedRecipeUsefulItem];
        }

        updatedRecipeUsefulItems.sort((a, b) => a.displayOrder - b.displayOrder);

        onUpdateRecipe({ usefulItems: updatedRecipeUsefulItems });
    };

    const handleMoveUsefulItemUp = (recipeUsefulItem: AdminRecipeUsefulItem) => {
        const items = [...(recipe.usefulItems || [])];
        const currentIndex = items.findIndex(item => item.id === recipeUsefulItem.id);
        if (currentIndex <= 0) return;

        const prevItem = items[currentIndex - 1];
        const currentItemDisplayOrder = items[currentIndex].displayOrder;

        items[currentIndex].displayOrder = prevItem.displayOrder;
        items[currentIndex - 1].displayOrder = currentItemDisplayOrder;

        items.sort((a, b) => a.displayOrder - b.displayOrder);
        onUpdateRecipe({ usefulItems: items });
    };

    const handleMoveUsefulItemDown = (recipeUsefulItem: AdminRecipeUsefulItem) => {
        const items = [...(recipe.usefulItems || [])];
        const currentIndex = items.findIndex(item => item.id === recipeUsefulItem.id);
        if (currentIndex === -1 || currentIndex >= items.length - 1) return;

        const nextItem = items[currentIndex + 1];
        const currentItemDisplayOrder = items[currentIndex].displayOrder;

        items[currentIndex].displayOrder = nextItem.displayOrder;
        items[currentIndex + 1].displayOrder = currentItemDisplayOrder;

        items.sort((a, b) => a.displayOrder - b.displayOrder);
        onUpdateRecipe({ usefulItems: items });
    };

    const handleCreateNewUsefulItem = () => {
        setNewUsefulItemModalVisible(true);
    };

    const handleNewUsefulItemCreated = (newUsefulItem: AdminUsefulItem) => {
        setUsefulItems(prev => [...prev, newUsefulItem]);
        setNewUsefulItemModalVisible(false);
        handleAddRecipeUsefulItem(newUsefulItem);
    };

    // Sort the selected useful items by display order
    const sortedRecipeUsefulItems = useMemo(() => {
        return [...(recipe.usefulItems || [])].sort((a, b) =>
            a.displayOrder - b.displayOrder
        );
    }, [recipe.usefulItems]);

    // Get IDs of already selected items
    const selectedItemIds = useMemo(() => {
        return (recipe.usefulItems || []).map(item => item.usefulItemId);
    }, [recipe.usefulItems]);

    return (
        <FormSection
            title={i18n.t('admin.recipes.form.usefulItemsInfo.title')}
            error={errors.usefulItems}
        >
            {isMobile ? (
                /* ===== MOBILE LAYOUT: Stacked, Selected first ===== */
                <View className="flex-col">
                    {/* Create New + Search */}
                    <View className="mb-md">
                        <Button
                            label={i18n.t('admin.recipes.form.usefulItemsInfo.createNew')}
                            variant="outline"
                            size="small"
                            onPress={handleCreateNewUsefulItem}
                            className="mb-sm"
                        />
                        <SearchBar
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            placeholder={i18n.t('admin.recipes.form.usefulItemsInfo.searchPlaceholder')}
                            className="w-full"
                        />
                    </View>

                    {/* Selected Items (FIRST on mobile) */}
                    <View className="mb-lg">
                        <SelectedItemsSection
                            items={sortedRecipeUsefulItems}
                            onEdit={handleEditRecipeUsefulItem}
                            onDelete={handleDeleteRecipeUsefulItem}
                            onMoveUp={handleMoveUsefulItemUp}
                            onMoveDown={handleMoveUsefulItemDown}
                            variant="compact"
                        />
                    </View>

                    {/* Available Items (SECOND on mobile) */}
                    <View>
                        <Text preset="subheading" className="mb-sm">
                            {i18n.t('admin.recipes.form.usefulItemsInfo.availableHeader', { defaultValue: 'Available Items' })}
                        </Text>
                        <AvailableItemsSection
                            items={filteredUsefulItems}
                            loading={loading}
                            searchQuery={searchQuery}
                            selectedItemIds={selectedItemIds}
                            onAddItem={handleAddRecipeUsefulItem}
                            variant="compact"
                        />
                    </View>
                </View>
            ) : (
                /* ===== DESKTOP LAYOUT: Two columns, Available first ===== */
                <>
                    {/* Header Row */}
                    <View className="flex-row items-center gap-md mb-md">
                        <View className="flex-1">
                            <Button
                                label={i18n.t('admin.recipes.form.usefulItemsInfo.createNew')}
                                variant="outline"
                                size="small"
                                onPress={handleCreateNewUsefulItem}
                                className="mb-sm max-w-[150px]"
                            />
                            <SearchBar
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                placeholder={i18n.t('admin.recipes.form.usefulItemsInfo.searchPlaceholder')}
                                className="w-full mr-sm"
                            />
                        </View>

                        {/* Empty space to maintain alignment with right column */}
                        <View className="flex-[1.8]" />
                    </View>

                    {/* Content Row */}
                    <View className="flex-row flex-wrap">
                        {/* Left Column - Available Items */}
                        <View className="flex-1 mr-md mb-md">
                            <AvailableItemsSection
                                items={filteredUsefulItems}
                                loading={loading}
                                searchQuery={searchQuery}
                                selectedItemIds={selectedItemIds}
                                onAddItem={handleAddRecipeUsefulItem}
                            />
                        </View>

                        {/* Right Column - Selected Items */}
                        <View className="flex-[1.8]">
                            <SelectedItemsSection
                                items={sortedRecipeUsefulItems}
                                onEdit={handleEditRecipeUsefulItem}
                                onDelete={handleDeleteRecipeUsefulItem}
                                onMoveUp={handleMoveUsefulItemUp}
                                onMoveDown={handleMoveUsefulItemDown}
                            />
                        </View>
                    </View>
                </>
            )}

            {/* Modals */}
            <RecipeUsefulItemFormModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSave={handleSaveRecipeUsefulItem}
                recipeUsefulItem={selectedRecipeUsefulItem}
                existingUsefulItems={recipe.usefulItems || []}
            />

            <CreateEditUsefulItemModal
                visible={newUsefulItemModalVisible}
                onClose={() => setNewUsefulItemModalVisible(false)}
                onSuccess={handleNewUsefulItemCreated}
            />

            <AlertModal
                visible={showErrorAlert}
                title={i18n.t('admin.recipes.form.usefulItemsInfo.errorTitle')}
                message={errorMessage}
                onConfirm={() => setShowErrorAlert(false)}
                confirmText={i18n.t('common.ok')}
            />
        </FormSection>
    );
}
