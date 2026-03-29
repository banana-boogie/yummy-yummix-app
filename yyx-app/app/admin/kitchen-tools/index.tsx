import React, { useState, useEffect, useMemo } from 'react';
import { View, ActivityIndicator, FlatList, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { COLORS } from '@/constants/design-tokens';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { KitchenToolCard } from '@/components/admin/kitchen-tools/KitchenToolCard';
import { useKitchenTools } from '@/hooks/admin/useKitchenTools';
import { AlertModal } from '@/components/common/AlertModal';
import { SearchBar } from '@/components/common/SearchBar';
import { AdminKitchenTool } from '@/types/recipe.admin.types';
import i18n from '@/i18n';
import { CreateEditKitchenToolModal } from '@/components/admin/kitchen-tools/CreateEditKitchenToolModal';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { AdminDisplayLocaleToggle } from '@/components/admin/recipes/forms/shared/AdminDisplayLocaleToggle';
import { useDevice } from '@/hooks/useDevice';
import logger from '@/services/logger';

type ImageFilter = 'all' | 'has_image' | 'needs_image';

export default function KitchenToolsAdminPage() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { isPhone } = useDevice();
  const {
    filteredKitchenTools,
    setFilteredKitchenTools,
    kitchenTools,
    setKitchenTools,
    loading,
    searchQuery,
    setSearchQuery,
    handleDeleteKitchenTool,
  } = useKitchenTools();

  const [displayLocale, setDisplayLocale] = useState(i18n.locale);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingKitchenTool, setEditingKitchenTool] = useState<AdminKitchenTool | null>(null);
  const [imageFilter, setImageFilter] = useState<ImageFilter>('all');
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Auto-open edit modal when navigating with ?edit=<id>
  useEffect(() => {
    if (edit && !loading && filteredKitchenTools.length > 0) {
      const target = filteredKitchenTools.find(kt => kt.id === edit);
      if (target) {
        setEditingKitchenTool(target);
        setModalVisible(true);
      }
    }
  }, [edit, loading, filteredKitchenTools]);

  // Apply image filter on top of search-filtered results
  const displayItems = useMemo(() => {
    if (imageFilter === 'all') return filteredKitchenTools;
    if (imageFilter === 'has_image') return filteredKitchenTools.filter(t => !!t.pictureUrl && typeof t.pictureUrl === 'string');
    return filteredKitchenTools.filter(t => !t.pictureUrl || typeof t.pictureUrl !== 'string');
  }, [filteredKitchenTools, imageFilter]);

  // Stats
  const totalCount = kitchenTools.length;
  const needsImageCount = kitchenTools.filter(t => !t.pictureUrl || typeof t.pictureUrl !== 'string').length;

  const handleOpenEditModal = (kitchenTool: AdminKitchenTool) => {
    setEditingKitchenTool(kitchenTool);
    setModalVisible(true);
  };

  const handleOpenCreateModal = () => {
    setEditingKitchenTool(null);
    setModalVisible(true);
  };

  const handleDelete = async (kitchenTool: AdminKitchenTool) => {
    try {
      await handleDeleteKitchenTool(kitchenTool);
    } catch (error) {
      logger.error('Error deleting kitchen tool:', error);
      setErrorMessage(i18n.t('admin.kitchenTools.errors.deleteFailed'));
      setShowErrorAlert(true);
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
      setKitchenTools(prev => [kitchenTool, ...prev]);
    }
    setModalVisible(false);
  };

  const numColumns = isPhone ? 2 : 5;

  const filterPills: { key: ImageFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'has_image', label: 'Has Image' },
    { key: 'needs_image', label: `Needs Image (${needsImageCount})` },
  ];

  return (
    <AdminLayout title={i18n.t('admin.kitchenTools.title')} showBackButton={true}>
      {/* Toolbar */}
      <View className="px-lg pt-md pb-sm bg-white">
        {/* Stats */}
        <Text preset="bodySmall" className="text-text-secondary mb-md">
          {totalCount} kitchen tools{needsImageCount > 0 ? ` · ${needsImageCount} need images` : ''}
        </Text>

        {/* Search + New */}
        <View className="flex-row items-center gap-md mb-sm">
          <View className="flex-1">
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              placeholder={i18n.t('admin.kitchenTools.searchPlaceholder')}
              className="mb-0"
            />
          </View>
          <Button
            onPress={handleOpenCreateModal}
            icon={<Ionicons name="add" size={20} color={COLORS.neutral.white} />}
            size="small"
          >
            New
          </Button>
        </View>

        {/* Locale toggle + Filter pills */}
        <View className="flex-row items-center justify-between">
          <AdminDisplayLocaleToggle value={displayLocale} onChange={setDisplayLocale} />
          <View className="flex-row gap-xs">
            {filterPills.map(pill => (
              <Text
                key={pill.key}
                preset="caption"
                className={`px-sm py-xxs rounded-full ${
                  imageFilter === pill.key
                    ? 'bg-primary-default text-text-default'
                    : 'bg-grey-light text-text-secondary'
                }`}
                onPress={() => setImageFilter(pill.key)}
                style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}}
              >
                {pill.label}
              </Text>
            ))}
          </View>
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
          extraData={displayLocale}
          numColumns={numColumns}
          renderItem={({ item }) => (
            <View style={{ flex: 1 / numColumns, padding: 6 }}>
              <KitchenToolCard
                kitchenTool={item}
                displayLocale={displayLocale}
                onPress={handleOpenEditModal}
              />
            </View>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 10 }}
          ListEmptyComponent={
            <View className="items-center justify-center p-xl">
              <Ionicons name="cube-outline" size={48} color={COLORS.grey.medium} />
              <Text preset="body" className="text-text-secondary mt-sm">
                {i18n.t('admin.kitchenTools.noItemsFound')}
              </Text>
            </View>
          }
        />
      )}

      {/* Edit/Create Modal */}
      <CreateEditKitchenToolModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        kitchenTool={editingKitchenTool as AdminKitchenTool}
        onSuccess={handleSuccessfullySavedKitchenTool}
        onDelete={handleDelete}
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
