import React, { useState } from 'react';
import { View, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { UsefulItemCard } from '@/components/admin/useful-items/UsefulItemCard';
import { useUsefulItems } from '@/hooks/admin/useUsefulItems';
import { AlertModal } from '@/components/common/AlertModal';
import { SearchBar } from '@/components/common/SearchBar';
import { AdminUsefulItem } from '@/types/recipe.admin.types';
import i18n from '@/i18n';
import { CreateEditUsefulItemModal } from '@/components/admin/useful-items/CreateEditUsefulItemModal';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';

export default function UsefulItemsAdminPage() {
  const {
    filteredUsefulItems,
    setFilteredUsefulItems,
    setUsefulItems,
    loading,
    searchQuery,
    setSearchQuery,
    handleDeleteUsefulItem,
  } = useUsefulItems();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingUsefulItem, setEditingUsefulItem] = useState<AdminUsefulItem | null>(null);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [selectedUsefulItem, setSelectedUsefulItem] = useState<AdminUsefulItem | null>(null);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleOpenEditModal = (usefulItem: AdminUsefulItem) => {
    setEditingUsefulItem(usefulItem);
    setModalVisible(true);
  };

  const handleOpenCreateModal = () => {
    setEditingUsefulItem(null);
    setModalVisible(true);
  };

  const handleDeleteConfirmation = (usefulItem: AdminUsefulItem) => {
    setSelectedUsefulItem(usefulItem);
    setShowDeleteAlert(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUsefulItem) return;

    try {
      await handleDeleteUsefulItem(selectedUsefulItem);
    } catch (error) {
      console.error('Error deleting useful item:', error);
      setErrorMessage(i18n.t('admin.usefulItems.errors.deleteFailed'));
      setShowErrorAlert(true);
    } finally {
      setShowDeleteAlert(false);
      setSelectedUsefulItem(null);
    }
  };

  const handleSuccessfullySavedUsefulItem = (usefulItem: AdminUsefulItem) => {
    if (editingUsefulItem && editingUsefulItem.id === usefulItem.id) {
      setFilteredUsefulItems(prev => prev.map(item =>
        item.id === usefulItem.id ? usefulItem : item
      ));
      setUsefulItems(prev => prev.map(item =>
        item.id === usefulItem.id ? usefulItem : item
      ));
    } else {
      setFilteredUsefulItems(prev => [usefulItem, ...prev]);
    }
    setModalVisible(false);
  };

  return (
    <AdminLayout title={i18n.t('admin.usefulItems.title')} showBackButton={true}>
      <View className="p-md" style={{ backgroundColor: '#ffffff' }}>
        <View className="flex-col sm:flex-row sm:items-center">
          <SearchBar
            className="flex-none sm:flex-1 mb-md sm:mb-0 sm:mr-md"
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder={i18n.t('admin.usefulItems.searchPlaceholder')}
          />

          <Button
            onPress={handleOpenCreateModal}
            icon={<Ionicons name="add" size={24} color={COLORS.neutral.WHITE} />}
            label={i18n.t('admin.usefulItems.createNew')}
          />
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={COLORS.primary.DARKEST} />
        </View>
      ) : (
        <FlatList
          data={filteredUsefulItems}
          renderItem={({ item }) => (
            <UsefulItemCard
              usefulItem={item}
              onEdit={handleOpenEditModal}
              onDelete={handleDeleteConfirmation}
            />
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          ListEmptyComponent={
            <View className="items-center justify-center p-xl">
              <Ionicons name="cube-outline" size={48} color={COLORS.grey.MEDIUM} />
              <Text preset="body" color={COLORS.text.secondary}>
                {i18n.t('admin.usefulItems.noItemsFound')}
              </Text>
            </View>
          }
        />
      )}

      {/* UsefulItem Edit/Create Modal */}
      <CreateEditUsefulItemModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        usefulItem={editingUsefulItem as AdminUsefulItem}
        onSuccess={handleSuccessfullySavedUsefulItem}
      />

      <AlertModal
        visible={showDeleteAlert}
        title={i18n.t('admin.usefulItems.confirmDeletion.title')}
        message={i18n.t('admin.usefulItems.confirmDeletion.message', {
          nameEn: selectedUsefulItem?.nameEn,
          nameEs: selectedUsefulItem?.nameEs
        })}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteAlert(false);
          setSelectedUsefulItem(null);
        }}
        confirmText={i18n.t('common.delete')}
        isDestructive={true}
      />

      <AlertModal
        visible={showErrorAlert}
        title={i18n.t('admin.usefulItems.errors.title')}
        message={errorMessage}
        onConfirm={() => setShowErrorAlert(false)}
        confirmText={i18n.t('common.ok')}
      />
    </AdminLayout>
  );
}
