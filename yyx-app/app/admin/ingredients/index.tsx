import React, { useState } from 'react';
import { View, ActivityIndicator, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

export default function IngredientsAdminPage() {
  const {
    filteredIngredients,
    setFilteredIngredients,
    loading,
    searchQuery,
    setSearchQuery,
    handleDeleteIngredient,
  } = useIngredients();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<AdminIngredient | null>(null);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<AdminIngredient | null>(null);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);

  const handleOpenEditModal = (ingredient: AdminIngredient) => {
    setEditingIngredient(ingredient);
    setModalVisible(true);
  };

  const handleOpenCreateModal = () => {
    setEditingIngredient(null);
    setModalVisible(true);
  };

  const handleDeleteConfirmation = (ingredient: AdminIngredient) => {
    setSelectedIngredient(ingredient);
    setShowDeleteAlert(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedIngredient) return;

    try {
      await handleDeleteIngredient(selectedIngredient);
    } catch (error) {
      console.error('Error deleting ingredient:', error);
      setErrorMessage('Failed to delete ingredient');
      setShowErrorAlert(true);
    } finally {
      setShowDeleteAlert(false);
      setSelectedIngredient(null);
    }
  };

  const handleSuccessfullySavedIngredient = (ingredient: AdminIngredient) => {
    if (editingIngredient && editingIngredient.id === ingredient.id) {
      setEditingIngredient(ingredient);
      setFilteredIngredients(prev => prev.map(item =>
        item.id === ingredient.id ? ingredient : item
      ));
    } else {
      setFilteredIngredients(prev => [ingredient, ...prev]);
    }
  };

  return (
    <AdminLayout title="Manage Ingredients" showBackButton={true}>
      <View className="p-md" style={{ backgroundColor: '#ffffff' }}>
        <View className="flex-col sm:flex-row sm:items-center">
          <SearchBar
            className="flex-none sm:flex-1 mb-md sm:mb-0 sm:mr-md"
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder="Search ingredients..."
          />

          <TouchableOpacity
            className="flex-row items-center bg-primary-dark px-md py-sm rounded-lg self-start sm:self-auto"
            onPress={handleOpenCreateModal}
          >
            <Ionicons name="add" size={24} color={COLORS.neutral.WHITE} />
            <Text color={COLORS.neutral.WHITE} className="ml-sm font-bold">New Ingredient</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={COLORS.primary.DARKEST} />
        </View>
      ) : (
        <FlatList
          data={filteredIngredients}
          renderItem={({ item }) => (
            <IngredientCard
              ingredient={item}
              onEdit={handleOpenEditModal}
              onDelete={handleDeleteConfirmation}
            />
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          ListEmptyComponent={
            <View className="items-center justify-center p-xl">
              <Ionicons name="leaf-outline" size={48} color={COLORS.grey.MEDIUM} />
              <Text className="mt-md text-base" color={COLORS.text.secondary}>No ingredients found</Text>
            </View>
          }
        />
      )}

      {/* Ingredient Edit/Create Modal */}
      <CreateEditIngredientModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        ingredient={editingIngredient as AdminIngredient}
        onSuccess={handleSuccessfullySavedIngredient}
      />

      <AlertModal
        visible={showDeleteAlert}
        title={i18n.t('admin.ingredients.confirmDeletion.title')}
        message={`${i18n.t('admin.ingredients.confirmDeletion.message')} ${selectedIngredient?.nameEn} | ${selectedIngredient?.nameEs}`}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteAlert(false);
          setSelectedIngredient(null);
        }}
        confirmText={i18n.t('common.delete')}
        isDestructive={true}
      />

      <AlertModal
        visible={showSuccessAlert}
        title={i18n.t('admin.ingredients.success.title')}
        message={i18n.t('admin.ingredients.success.message')}
        onConfirm={() => setShowSuccessAlert(false)}
        confirmText={i18n.t('common.ok')}
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
