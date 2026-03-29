import React, { useState, useEffect, useMemo } from 'react';
import { View, ActivityIndicator, FlatList, Platform, Pressable } from 'react-native';
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
import { Text } from '@/components/common/Text';
import { AdminDisplayLocaleToggle } from '@/components/admin/recipes/forms/shared/AdminDisplayLocaleToggle';
import { useDevice } from '@/hooks/useDevice';
import logger from '@/services/logger';

type ImageFilter = 'all' | 'has_image' | 'needs_image';

function hasValidImage(url: unknown): boolean {
  return typeof url === 'string' && url.length > 0 && url.startsWith('http');
}

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

  useEffect(() => {
    if (edit && !loading && filteredKitchenTools.length > 0) {
      const target = filteredKitchenTools.find(kt => kt.id === edit);
      if (target) {
        setEditingKitchenTool(target);
        setModalVisible(true);
      }
    }
  }, [edit, loading, filteredKitchenTools]);

  const displayItems = useMemo(() => {
    if (imageFilter === 'all') return filteredKitchenTools;
    if (imageFilter === 'has_image') return filteredKitchenTools.filter(t => hasValidImage(t.pictureUrl));
    return filteredKitchenTools.filter(t => !hasValidImage(t.pictureUrl));
  }, [filteredKitchenTools, imageFilter]);

  const totalCount = kitchenTools.length;
  const needsImageCount = kitchenTools.filter(t => !hasValidImage(t.pictureUrl)).length;

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

  const numColumns = isPhone ? 2 : 3;

  const filterPills: { key: ImageFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'has_image', label: 'Has Image' },
    { key: 'needs_image', label: `Needs Image (${needsImageCount})` },
  ];

  return (
    <AdminLayout title={i18n.t('admin.kitchenTools.title')} showBackButton={true}>
      {/* Toolbar */}
      <View className="px-lg pt-md pb-md bg-white">
        {/* Stats */}
        <Text preset="caption" className="text-text-secondary mb-md">
          {totalCount} items{needsImageCount > 0 ? ` · ${needsImageCount} need images` : ''}
        </Text>

        {/* Search + New */}
        {/* Toolbar bar: filters + locale in one contained row */}
        <View className="flex-row items-center justify-between bg-grey-light rounded-lg px-md py-sm mb-md">
          <View className="flex-row items-center gap-xs">
            {filterPills.map(pill => (
              <Pressable
                key={pill.key}
                onPress={() => setImageFilter(pill.key)}
                className={`px-sm py-xxs rounded-full ${
                  imageFilter === pill.key
                    ? 'bg-primary-default'
                    : ''
                }`}
                style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}}
              >
                <Text
                  preset="caption"
                  className={imageFilter === pill.key ? 'text-text-default font-semibold' : 'text-text-secondary'}
                >
                  {pill.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Separator */}
          <View className="w-[1px] h-[18px] bg-grey-medium mx-sm" />

          <AdminDisplayLocaleToggle value={displayLocale} onChange={setDisplayLocale} />
        </View>

        {/* Search + New */}
        <View className="flex-row items-center gap-sm">
          <View className="flex-1" style={{ marginBottom: -16 }}>
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              placeholder={i18n.t('admin.kitchenTools.searchPlaceholder')}
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
          extraData={`${displayLocale}-${imageFilter}`}
          numColumns={numColumns}
          renderItem={({ item }) => (
            <View style={{ flex: 1 / numColumns, padding: 12 }}>
              <KitchenToolCard
                kitchenTool={item}
                displayLocale={displayLocale}
                onPress={handleOpenEditModal}
              />
            </View>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 12, paddingTop: 20 }}
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
