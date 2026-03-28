import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { COLORS } from '@/constants/design-tokens';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { KitchenToolCard } from '@/components/admin/kitchen-tools/KitchenToolCard';
import { useKitchenTools } from '@/hooks/admin/useKitchenTools';
import { AlertModal } from '@/components/common/AlertModal';
import { SearchBar } from '@/components/common/SearchBar';
import { AdminKitchenTool, getTranslatedField } from '@/types/recipe.admin.types';
import i18n from '@/i18n';
import { CreateEditKitchenToolModal } from '@/components/admin/kitchen-tools/CreateEditKitchenToolModal';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { AdminDisplayLocaleToggle } from '@/components/admin/recipes/forms/shared/AdminDisplayLocaleToggle';
import logger from '@/services/logger';

export default function KitchenToolsAdminPage() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const {
    filteredKitchenTools,
    setFilteredKitchenTools,
    setKitchenTools,
    loading,
    searchQuery,
    setSearchQuery,
    handleDeleteKitchenTool,
  } = useKitchenTools();

  const [displayLocale, setDisplayLocale] = useState(i18n.locale);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingKitchenTool, setEditingKitchenTool] = useState<AdminKitchenTool | null>(null);

  // Auto-open edit modal when navigating with ?edit=<id> (e.g. from content health dashboard)
  useEffect(() => {
    if (edit && !loading && filteredKitchenTools.length > 0) {
      const target = filteredKitchenTools.find(kt => kt.id === edit);
      if (target) {
        setEditingKitchenTool(target);
        setModalVisible(true);
      }
    }
  }, [edit, loading, filteredKitchenTools]);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [selectedKitchenTool, setSelectedKitchenTool] = useState<AdminKitchenTool | null>(null);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleOpenEditModal = (kitchenTool: AdminKitchenTool) => {
    setEditingKitchenTool(kitchenTool);
    setModalVisible(true);
  };

  const handleOpenCreateModal = () => {
    setEditingKitchenTool(null);
    setModalVisible(true);
  };

  const handleDeleteConfirmation = (kitchenTool: AdminKitchenTool) => {
    setSelectedKitchenTool(kitchenTool);
    setShowDeleteAlert(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedKitchenTool) return;

    try {
      await handleDeleteKitchenTool(selectedKitchenTool);
    } catch (error) {
      logger.error('Error deleting kitchen tool:', error);
      setErrorMessage(i18n.t('admin.kitchenTools.errors.deleteFailed'));
      setShowErrorAlert(true);
    } finally {
      setShowDeleteAlert(false);
      setSelectedKitchenTool(null);
    }
  };

  const handleSuccessfullySavedKitchenTool = (kitchenTool: AdminKitchenTool) => {
    if (editingKitchenTool && editingKitchenTool.id === kitchenTool.id) {
      setFilteredKitchenTools(prev => prev.map(item =>
        item.id === kitchenTool.id ? kitchenTool : item
      ));
      setKitchenTools(prev => prev.map(item =>
        item.id === kitchenTool.id ? kitchenTool : item
      ));
    } else {
      setFilteredKitchenTools(prev => [kitchenTool, ...prev]);
    }
    setModalVisible(false);
  };

  return (
    <AdminLayout title={i18n.t('admin.kitchenTools.title')} showBackButton={true}>
      <View className="p-md" style={{ backgroundColor: '#ffffff' }}>
        <View className="mb-md">
          <AdminDisplayLocaleToggle value={displayLocale} onChange={setDisplayLocale} />
        </View>
        <View className="flex-col sm:flex-row sm:items-center gap-md">
          <SearchBar
            className="flex-none sm:flex-1"
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder={i18n.t('admin.kitchenTools.searchPlaceholder')}
          />
          <Button
            onPress={handleOpenCreateModal}
            icon={<Ionicons name="add" size={24} color={COLORS.neutral.white} />}
            label={i18n.t('admin.kitchenTools.createNew')}
          />
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={COLORS.primary.darkest} />
        </View>
      ) : (
        <FlatList
          data={filteredKitchenTools}
          extraData={displayLocale}
          renderItem={({ item }) => (
            <KitchenToolCard
              kitchenTool={item}
              displayLocale={displayLocale}
              onEdit={handleOpenEditModal}
              onDelete={handleDeleteConfirmation}
            />
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          ListEmptyComponent={
            <View className="items-center justify-center p-xl">
              <Ionicons name="cube-outline" size={48} color={COLORS.grey.medium} />
              <Text preset="body" color={COLORS.text.secondary}>
                {i18n.t('admin.kitchenTools.noItemsFound')}
              </Text>
            </View>
          }
        />
      )}

      {/* KitchenTool Edit/Create Modal */}
      <CreateEditKitchenToolModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        kitchenTool={editingKitchenTool as AdminKitchenTool}
        onSuccess={handleSuccessfullySavedKitchenTool}
      />

      <AlertModal
        visible={showDeleteAlert}
        title={i18n.t('admin.kitchenTools.confirmDeletion.title')}
        message={i18n.t('admin.kitchenTools.confirmDeletion.message', {
          name: getTranslatedField(selectedKitchenTool?.translations, displayLocale, 'name'),
        })}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteAlert(false);
          setSelectedKitchenTool(null);
        }}
        confirmText={i18n.t('common.delete')}
        isDestructive={true}
      />

      <AlertModal
        visible={showErrorAlert}
        title={i18n.t('admin.kitchenTools.errors.title')}
        message={errorMessage}
        onConfirm={() => setShowErrorAlert(false)}
        confirmText={i18n.t('common.ok')}
      />
    </AdminLayout>
  );
}
