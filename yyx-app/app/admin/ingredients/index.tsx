import React, { useState, useEffect, useMemo } from 'react';
import { View, ActivityIndicator, FlatList, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { COLORS } from '@/constants/design-tokens';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { IngredientCard } from '@/components/admin/ingredients/IngredientCard';
import { useIngredients } from '@/hooks/admin/useIngredients';
import { AlertModal } from '@/components/common/AlertModal';
import { SearchBar } from '@/components/common/SearchBar';
import { AdminIngredient } from '@/types/recipe.admin.types';
import i18n from '@/i18n';
import { CreateEditIngredientModal } from '@/components/admin/ingredients/CreateEditIngredientModal';
import { Text } from '@/components/common/Text';
import { AdminDisplayLocaleToggle } from '@/components/admin/recipes/forms/shared/AdminDisplayLocaleToggle';
import { useDevice } from '@/hooks/useDevice';
import logger from '@/services/logger';

type IngredientFilter = 'all' | 'has_image' | 'needs_image' | 'needs_nutrition';

function hasValidImage(url: unknown): boolean {
  return typeof url === 'string' && url.length > 0 && url.startsWith('http');
}

function hasNutrition(ingredient: AdminIngredient): boolean {
  const facts = ingredient.nutritionalFacts;
  if (!facts) return false;
  return (
    facts.calories !== undefined && facts.calories !== '' &&
    facts.protein !== undefined && facts.protein !== '' &&
    facts.fat !== undefined && facts.fat !== '' &&
    facts.carbohydrates !== undefined && facts.carbohydrates !== ''
  );
}

export default function IngredientsAdminPage() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { isPhone } = useDevice();
  const {
    filteredIngredients,
    setFilteredIngredients,
    ingredients,
    setIngredients,
    loading,
    searchQuery,
    setSearchQuery,
    handleDeleteIngredient,
  } = useIngredients();

  const [displayLocale, setDisplayLocale] = useState(i18n.locale);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<AdminIngredient | null>(null);
  const [ingredientFilter, setIngredientFilter] = useState<IngredientFilter>('all');
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Auto-open edit modal when navigating with ?edit=<id>
  useEffect(() => {
    if (edit && !loading && filteredIngredients.length > 0) {
      const target = filteredIngredients.find(ing => ing.id === edit);
      if (target) {
        setEditingIngredient(target);
        setModalVisible(true);
      }
    }
  }, [edit, loading, filteredIngredients]);

  const displayItems = useMemo(() => {
    if (ingredientFilter === 'all') return filteredIngredients;
    if (ingredientFilter === 'has_image') return filteredIngredients.filter(t => hasValidImage(t.pictureUrl));
    if (ingredientFilter === 'needs_image') return filteredIngredients.filter(t => !hasValidImage(t.pictureUrl));
    return filteredIngredients.filter(t => !hasNutrition(t));
  }, [filteredIngredients, ingredientFilter]);

  const totalCount = ingredients.length;
  const needsImageCount = ingredients.filter(t => !hasValidImage(t.pictureUrl)).length;
  const needsNutritionCount = ingredients.filter(t => !hasNutrition(t)).length;

  const handleOpenEditModal = (ingredient: AdminIngredient) => {
    setEditingIngredient(ingredient);
    setModalVisible(true);
  };

  const handleOpenCreateModal = () => {
    setEditingIngredient(null);
    setModalVisible(true);
  };

  const handleDelete = async (ingredient: AdminIngredient) => {
    try {
      await handleDeleteIngredient(ingredient);
    } catch (error) {
      logger.error('Error deleting ingredient:', error);
      setErrorMessage(i18n.t('admin.ingredients.errors.saveFailed'));
      setShowErrorAlert(true);
    }
  };

  const handleSuccessfullySavedIngredient = (ingredient: AdminIngredient) => {
    if (editingIngredient && editingIngredient.id === ingredient.id) {
      setFilteredIngredients(prev => prev.map(item =>
        item.id === ingredient.id ? ingredient : item
      ));
      setIngredients(prev => prev.map(item =>
        item.id === ingredient.id ? ingredient : item
      ));
    } else {
      setFilteredIngredients(prev => [ingredient, ...prev]);
      setIngredients(prev => [ingredient, ...prev]);
    }
    setModalVisible(false);
  };

  const numColumns = isPhone ? 2 : 3;

  const filterPills: { key: IngredientFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'has_image', label: 'Has Image' },
    { key: 'needs_image', label: `No Image (${needsImageCount})` },
    { key: 'needs_nutrition', label: `No Nutrition (${needsNutritionCount})` },
  ];

  // Build stats caption
  const statParts = [`${totalCount} ingredients`];
  if (needsImageCount > 0) statParts.push(`${needsImageCount} need images`);
  if (needsNutritionCount > 0) statParts.push(`${needsNutritionCount} need nutrition`);

  return (
    <AdminLayout title={i18n.t('admin.ingredients.editTitle').replace('Edit ', 'Manage ')} showBackButton={true}>
      {/* Toolbar */}
      <View className="px-lg pt-lg pb-lg bg-white">
        {/* Stats */}
        <Text preset="body" className="text-text-default font-semibold mb-md">
          {totalCount} ingredients
          {needsImageCount > 0 && (
            <Text preset="body" style={{ color: COLORS.status.warning }}> · {needsImageCount} need images</Text>
          )}
          {needsNutritionCount > 0 && (
            <Text preset="body" style={{ color: COLORS.status.warning }}> · {needsNutritionCount} need nutrition</Text>
          )}
        </Text>

        {/* Filter pills + locale toggle in one bar */}
        <View className="flex-row items-center justify-between bg-grey-light rounded-lg px-md py-sm mb-md">
          <View className="flex-row items-center gap-xs">
            {filterPills.map(pill => (
              <Pressable
                key={pill.key}
                onPress={() => setIngredientFilter(pill.key)}
                className={`px-sm py-xxs rounded-full ${
                  ingredientFilter === pill.key
                    ? 'bg-primary-default'
                    : ''
                }`}
                style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}}
              >
                <Text
                  preset="caption"
                  className={ingredientFilter === pill.key ? 'text-text-default font-semibold' : 'text-text-secondary'}
                >
                  {pill.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="w-[1px] h-[18px] bg-grey-medium mx-sm" />

          <AdminDisplayLocaleToggle value={displayLocale} onChange={setDisplayLocale} />
        </View>

        {/* Search + New */}
        <View className="flex-row items-center gap-sm">
          <View className="flex-1" style={{ marginBottom: -16 }}>
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              placeholder="Search ingredients..."
              className="mb-0"
            />
          </View>
          <Pressable
            onPress={handleOpenCreateModal}
            className="flex-row items-center gap-xxs px-lg py-md border border-border-default rounded-full"
            style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}}
          >
            <Ionicons name="add" size={16} color={COLORS.text.default} />
            <Text preset="bodySmall" className="text-text-default">New</Text>
          </Pressable>
        </View>
      </View>

      {/* Grid */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={COLORS.primary.darkest} />
        </View>
      ) : (
        <FlatList
          key={`grid-${numColumns}`}
          data={displayItems}
          extraData={`${displayLocale}-${ingredientFilter}`}
          numColumns={numColumns}
          renderItem={({ item }) => (
            <View style={{ flex: 1 / numColumns, padding: 12 }}>
              <IngredientCard
                ingredient={item}
                displayLocale={displayLocale}
                onPress={handleOpenEditModal}
              />
            </View>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 12, paddingTop: 20 }}
          ListEmptyComponent={
            <View className="items-center justify-center p-xl">
              <Ionicons name="leaf-outline" size={48} color={COLORS.grey.medium} />
              <Text preset="body" className="text-text-secondary mt-sm">
                No ingredients found
              </Text>
            </View>
          }
        />
      )}

      <CreateEditIngredientModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        ingredient={editingIngredient as AdminIngredient}
        onSuccess={handleSuccessfullySavedIngredient}
        onDelete={handleDelete}
      />

      <AlertModal
        visible={showErrorAlert}
        title={i18n.t('admin.ingredients.errors.title')}
        message={errorMessage}
        onConfirm={() => setShowErrorAlert(false)}
        confirmText={i18n.t('common.ok')}
      />
    </AdminLayout>
  );
}
