import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import { AdminRecipe, AdminRecipeKitchenTool, AdminKitchenTool, getTranslatedField } from '@/types/recipe.admin.types';
import i18n from '@/i18n';
import { ErrorMessage } from '@/components/common';
import { adminKitchenToolsService } from '@/services/admin/adminKitchenToolsService';
import { SearchBar } from '@/components/common/SearchBar';
import { Button } from '@/components/common/Button';
import { AlertModal } from '@/components/common/AlertModal';
import { v4 as generateUUID } from 'uuid';
import { RecipeKitchenToolFormModal } from './RecipeKitchenToolFormModal';
import { CreateEditKitchenToolModal } from '@/components/admin/kitchen-tools/CreateEditKitchenToolModal';
import { COLORS } from '@/constants/design-tokens';
import { useDevice } from '@/hooks/useDevice';
import logger from '@/services/logger';
import { SelectedItemsSection } from './SelectedItemsSection';
import { AvailableItemsSection } from './AvailableItemsSection';
import { AdminRecipeKitchenToolCard } from './AdminRecipeKitchenToolCard';

type KitchenToolsFormProps = {
    recipe: AdminRecipe;
    onUpdateRecipe: (updates: Partial<AdminRecipe>) => void;
    errors: Record<string, string>;
    authoringLocale?: string;
    displayLocale?: string;
};

export function RecipeKitchenToolsForm({ recipe, onUpdateRecipe, errors, authoringLocale = 'es', displayLocale }: KitchenToolsFormProps) {
    const { isMobile } = useDevice();
    const [kitchenTools, setKitchenTools] = useState<AdminKitchenTool[]>([]);
    const [filteredKitchenTools, setFilteredKitchenTools] = useState<AdminKitchenTool[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRecipeKitchenTool, setSelectedRecipeKitchenTool] = useState<AdminRecipeKitchenTool>();
    const [modalVisible, setModalVisible] = useState(false);
    const [newKitchenToolModalVisible, setNewKitchenToolModalVisible] = useState(false);
    const [showErrorAlert, setShowErrorAlert] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [rightColHeight, setRightColHeight] = useState<number | undefined>(undefined);

    // Initialize kitchenTools array if it doesn't exist
    useEffect(() => {
        if (!recipe.kitchenTools) {
            onUpdateRecipe({ kitchenTools: [] });
        }
    }, []);

    // Load all kitchen tools from the API
    useEffect(() => {
        const fetchKitchenTools = async () => {
            try {
                setLoading(true);
                const fetchedKitchenTools = await adminKitchenToolsService.getAllKitchenTools();
                setKitchenTools(fetchedKitchenTools);
                setFilteredKitchenTools(fetchedKitchenTools);
            } catch (error) {
                logger.error('Error fetching kitchen tools:', error);
                setErrorMessage(i18n.t('admin.recipes.form.kitchenToolsInfo.fetchError'));
                setShowErrorAlert(true);
            } finally {
                setLoading(false);
            }
        };

        fetchKitchenTools();
    }, []);

    // Filter kitchen tools when search query changes
    useEffect(() => {
        if (searchQuery) {
            const lowercaseQuery = searchQuery.toLowerCase();
            const filtered = kitchenTools.filter(item => {
                const nameEn = getTranslatedField(item.translations, 'en', 'name');
                const nameEs = getTranslatedField(item.translations, 'es', 'name');
                return nameEn?.toLowerCase().includes(lowercaseQuery) ||
                    nameEs?.toLowerCase().includes(lowercaseQuery);
            });
            setFilteredKitchenTools(filtered);
        } else {
            setFilteredKitchenTools(kitchenTools);
        }
    }, [searchQuery, kitchenTools]);

    const handleAddRecipeKitchenTool = (kitchenTool: AdminKitchenTool) => {
        const newRecipeKitchenTool: AdminRecipeKitchenTool = {
            id: generateUUID(),
            recipeId: recipe.id || '',
            kitchenToolId: kitchenTool.id,
            displayOrder: recipe.kitchenTools ? recipe.kitchenTools.length : 0,
            kitchenTool,
        };

        setSelectedRecipeKitchenTool(newRecipeKitchenTool);
        setModalVisible(true);
    };

    const handleEditRecipeKitchenTool = (kitchenTool: AdminRecipeKitchenTool) => {
        setSelectedRecipeKitchenTool(kitchenTool);
        setModalVisible(true);
    };

    const handleDeleteRecipeKitchenTool = (recipeKitchenTool: AdminRecipeKitchenTool) => {
        const updatedKitchenTools = (recipe.kitchenTools || []).filter(
            item => item.id !== recipeKitchenTool.id
        );

        const reorderedKitchenTools = updatedKitchenTools.map((item, index) => ({
            ...item,
            displayOrder: index
        }));

        onUpdateRecipe({ kitchenTools: reorderedKitchenTools });
    };

    const handleSaveRecipeKitchenTool = (updatedRecipeKitchenTool: AdminRecipeKitchenTool) => {
        let updatedRecipeKitchenTools: AdminRecipeKitchenTool[] = recipe.kitchenTools || [];

        const existingIndex = updatedRecipeKitchenTools.findIndex(
            item => item.id === updatedRecipeKitchenTool.id
        );

        if (existingIndex >= 0) {
            updatedRecipeKitchenTools = [...updatedRecipeKitchenTools];
            updatedRecipeKitchenTools[existingIndex] = updatedRecipeKitchenTool;
        } else {
            updatedRecipeKitchenTools = [...updatedRecipeKitchenTools, updatedRecipeKitchenTool];
        }

        updatedRecipeKitchenTools.sort((a, b) => a.displayOrder - b.displayOrder);

        onUpdateRecipe({ kitchenTools: updatedRecipeKitchenTools });
    };

    const handleMoveKitchenToolUp = (recipeKitchenTool: AdminRecipeKitchenTool) => {
        const items = [...(recipe.kitchenTools || [])];
        const currentIndex = items.findIndex(item => item.id === recipeKitchenTool.id);
        if (currentIndex <= 0) return;

        const prevItem = items[currentIndex - 1];
        const currentItemDisplayOrder = items[currentIndex].displayOrder;

        items[currentIndex].displayOrder = prevItem.displayOrder;
        items[currentIndex - 1].displayOrder = currentItemDisplayOrder;

        items.sort((a, b) => a.displayOrder - b.displayOrder);
        onUpdateRecipe({ kitchenTools: items });
    };

    const handleMoveKitchenToolDown = (recipeKitchenTool: AdminRecipeKitchenTool) => {
        const items = [...(recipe.kitchenTools || [])];
        const currentIndex = items.findIndex(item => item.id === recipeKitchenTool.id);
        if (currentIndex === -1 || currentIndex >= items.length - 1) return;

        const nextItem = items[currentIndex + 1];
        const currentItemDisplayOrder = items[currentIndex].displayOrder;

        items[currentIndex].displayOrder = nextItem.displayOrder;
        items[currentIndex + 1].displayOrder = currentItemDisplayOrder;

        items.sort((a, b) => a.displayOrder - b.displayOrder);
        onUpdateRecipe({ kitchenTools: items });
    };

    const handleCreateNewKitchenTool = () => {
        setNewKitchenToolModalVisible(true);
    };

    const handleNewKitchenToolCreated = (newKitchenTool: AdminKitchenTool) => {
        setKitchenTools(prev => [...prev, newKitchenTool]);
        setNewKitchenToolModalVisible(false);
        handleAddRecipeKitchenTool(newKitchenTool);
    };

    // Sort the selected kitchen tools by display order
    const sortedRecipeKitchenTools = useMemo(() => {
        return [...(recipe.kitchenTools || [])].sort((a, b) =>
            a.displayOrder - b.displayOrder
        );
    }, [recipe.kitchenTools]);

    // Get IDs of already selected items
    const selectedItemIds = useMemo(() => {
        return (recipe.kitchenTools || []).map(item => item.kitchenToolId);
    }, [recipe.kitchenTools]);

    return (
        <View className="mt-lg w-full flex-1">
            {errors.kitchenTools ? (
                <View className="mb-sm">
                    <ErrorMessage message={errors.kitchenTools} />
                </View>
            ) : null}
            {isMobile ? (
                /* ===== MOBILE LAYOUT: Stacked, Selected first ===== */
                <View className="flex-col">
                    {/* Create New + Search */}
                    <View className="mb-md">
                        <Button
                            label={i18n.t('admin.recipes.form.kitchenToolsInfo.createNew')}
                            variant="outline"
                            size="small"
                            onPress={handleCreateNewKitchenTool}
                            className="mb-sm"
                        />
                        <SearchBar
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            placeholder={i18n.t('admin.recipes.form.kitchenToolsInfo.searchPlaceholder')}
                            className="w-full"
                        />
                    </View>

                    {/* Selected Items (FIRST on mobile) */}
                    <View className="mb-lg">
                        <SelectedItemsSection
                            items={sortedRecipeKitchenTools}
                            displayLocale={displayLocale || authoringLocale}
                            onEdit={handleEditRecipeKitchenTool}
                            onDelete={handleDeleteRecipeKitchenTool}
                            onMoveUp={handleMoveKitchenToolUp}
                            onMoveDown={handleMoveKitchenToolDown}
                            variant="compact"
                        />
                    </View>

                    {/* Available Items (SECOND on mobile) */}
                    <View>
                        <Text preset="subheading" className="mb-sm">
                            {i18n.t('admin.recipes.form.kitchenToolsInfo.availableHeader', { defaultValue: 'Available Items' })}
                        </Text>
                        <AvailableItemsSection
                            items={filteredKitchenTools}
                            loading={loading}
                            searchQuery={searchQuery}
                            selectedItemIds={selectedItemIds}
                            onAddItem={handleAddRecipeKitchenTool}
                            displayLocale={displayLocale || authoringLocale}
                            variant="compact"
                        />
                    </View>
                </View>
            ) : (
                /* ===== DESKTOP LAYOUT: Fixed two-column with CSS ===== */
                <View
                    style={{
                        display: 'flex' as any,
                        flexDirection: 'column' as any,
                        flex: 1,
                        minHeight: 0,
                    }}
                >
                    {/* Header row: search left, label right — aligned */}
                    <View
                        style={{
                            display: 'flex' as any,
                            flexDirection: 'row' as any,
                            gap: 16,
                            marginBottom: 12,
                        }}
                    >
                        <View style={{ flex: 2 }}>
                            <View className="flex-row items-center gap-sm" style={{ marginBottom: -12 }}>
                                <View style={{ flex: 1 }}>
                                    <SearchBar
                                        searchQuery={searchQuery}
                                        setSearchQuery={setSearchQuery}
                                        placeholder={i18n.t('admin.recipes.form.kitchenToolsInfo.searchPlaceholder')}
                                    />
                                </View>
                                <TouchableOpacity
                                    onPress={handleCreateNewKitchenTool}
                                    className="flex-row items-center gap-xxs"
                                >
                                    <Ionicons name="add" size={14} color={COLORS.text.secondary} />
                                    <Text preset="caption" className="text-text-secondary">
                                        {i18n.t('admin.recipes.form.kitchenToolsInfo.createNew')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={{ flex: 3 }}>
                            <View className="flex-row justify-between items-center">
                                <Text preset="bodySmall" className="text-text-secondary font-medium">
                                    {i18n.t('admin.recipes.form.kitchenToolsInfo.selectedHeader')}
                                </Text>
                                <Text preset="caption" className="text-text-secondary">
                                    {sortedRecipeKitchenTools.length} items
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Two columns — both scroll independently, same height */}
                    <View
                        style={{
                            display: 'flex' as any,
                            flexDirection: 'row' as any,
                            gap: 16,
                            flex: 1,
                            minHeight: 400,
                        }}
                    >
                        {/* Left: available items (40%) */}
                        <View
                            style={{
                                flex: 2,
                                overflow: 'auto' as any,
                                borderRadius: 8,
                            }}
                        >
                            <AvailableItemsSection
                                items={filteredKitchenTools}
                                loading={loading}
                                searchQuery={searchQuery}
                                selectedItemIds={selectedItemIds}
                                onAddItem={handleAddRecipeKitchenTool}
                                displayLocale={displayLocale || authoringLocale}
                            />
                        </View>

                        {/* Right: selected items (60%) */}
                        <View
                            style={{
                                flex: 3,
                                overflow: 'auto' as any,
                                backgroundColor: COLORS.background.secondary,
                                borderRadius: 8,
                                padding: 12,
                            }}
                        >
                            {sortedRecipeKitchenTools.length === 0 ? (
                                <View className="flex-1 items-center justify-center">
                                    <Ionicons name="information-circle-outline" size={32} color={COLORS.text.secondary} />
                                    <Text className="mt-sm text-center" color={COLORS.text.secondary}>
                                        {i18n.t('admin.recipes.form.kitchenToolsInfo.noSelectedItems')}
                                    </Text>
                                </View>
                            ) : (
                                sortedRecipeKitchenTools.map(item => (
                                    <AdminRecipeKitchenToolCard
                                        key={item.id}
                                        recipeKitchenTool={item}
                                        displayLocale={displayLocale || authoringLocale}
                                        onEdit={() => handleEditRecipeKitchenTool(item)}
                                        onDelete={() => handleDeleteRecipeKitchenTool(item)}
                                        onMoveUp={() => handleMoveKitchenToolUp(item)}
                                        onMoveDown={() => handleMoveKitchenToolDown(item)}
                                    />
                                ))
                            )}
                        </View>
                    </View>
                </View>
            )}

            {/* Modals */}
            <RecipeKitchenToolFormModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSave={handleSaveRecipeKitchenTool}
                recipeKitchenTool={selectedRecipeKitchenTool}
                existingKitchenTools={recipe.kitchenTools || []}
                authoringLocale={authoringLocale}
            />

            <CreateEditKitchenToolModal
                visible={newKitchenToolModalVisible}
                onClose={() => setNewKitchenToolModalVisible(false)}
                onSuccess={handleNewKitchenToolCreated}
            />

            <AlertModal
                visible={showErrorAlert}
                title={i18n.t('admin.recipes.form.kitchenToolsInfo.errorTitle')}
                message={errorMessage}
                onConfirm={() => setShowErrorAlert(false)}
                confirmText={i18n.t('common.ok')}
            />
        </View>
    );
}
