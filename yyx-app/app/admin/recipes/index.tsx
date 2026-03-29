import React, { useEffect, useState } from 'react';
import { View, FlatList, Pressable, ActivityIndicator, Switch, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import adminRecipeService from '@/services/admin/adminRecipeService';
import { AdminRecipe, getTranslatedField } from '@/types/recipe.admin.types';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AlertModal } from '@/components/common/AlertModal';
import { SearchBar } from '@/components/common/SearchBar';
import { AdminDisplayLocaleToggle } from '@/components/admin/recipes/forms/shared/AdminDisplayLocaleToggle';
import i18n from '@/i18n';
import logger from '@/services/logger';

type StatusFilter = 'all' | 'published' | 'draft';
type SortField = 'name' | 'isPublished' | 'dateAdded' | 'dateUpdated';

export default function RecipesAdminPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<AdminRecipe[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<AdminRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortField>('dateUpdated');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState<AdminRecipe | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [publishAction, setPublishAction] = useState<'publish' | 'unpublish'>('publish');
  const [recipeToPublish, setRecipeToPublish] = useState<AdminRecipe | null>(null);
  const [displayLocale, setDisplayLocale] = useState(i18n.locale);

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const data = await adminRecipeService.getAllRecipesForAdmin();
      setRecipes(data);
      setFilteredRecipes(data);
    } catch (error) {
      logger.error('Error fetching recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...recipes];

    if (searchQuery) {
      filtered = filtered.filter(recipe => {
        const name = getTranslatedField(recipe.translations, displayLocale, 'name');
        return name?.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    if (statusFilter === 'published') {
      filtered = filtered.filter(recipe => recipe.isPublished);
    } else if (statusFilter === 'draft') {
      filtered = filtered.filter(recipe => !recipe.isPublished);
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = (getTranslatedField(a.translations, displayLocale, 'name') || '').localeCompare(getTranslatedField(b.translations, displayLocale, 'name') || '');
          break;
        case 'isPublished':
          comparison = (a.isPublished === b.isPublished) ? 0 : a.isPublished ? -1 : 1;
          break;
        case 'dateAdded':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'dateUpdated':
        default:
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setFilteredRecipes(filtered);
  }, [recipes, searchQuery, statusFilter, sortBy, sortDirection, displayLocale]);

  const handleTogglePublished = (recipe: AdminRecipe) => {
    setRecipeToPublish(recipe);
    setPublishAction(recipe.isPublished ? 'unpublish' : 'publish');
    setShowPublishConfirm(true);
  };

  const confirmTogglePublish = async (id: string, currentStatus: boolean) => {
    try {
      await adminRecipeService.toggleRecipePublished(id, !currentStatus);
      setRecipes(prev => prev.map(r => r.id === id ? { ...r, isPublished: !currentStatus } : r));
    } catch (error) {
      logger.error('Error toggling recipe publish status:', error);
    } finally {
      setShowPublishConfirm(false);
      setRecipeToPublish(null);
    }
  };

  const handleSortChange = (field: SortField) => {
    if (sortBy === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const handleDeleteRecipe = (recipe: AdminRecipe) => {
    setRecipeToDelete(recipe);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteRecipe = async () => {
    if (!recipeToDelete) return;
    try {
      await adminRecipeService.deleteRecipe(recipeToDelete.id);
      setRecipes(prev => prev.filter(r => r.id !== recipeToDelete.id));
      setShowDeleteConfirm(false);
      setRecipeToDelete(null);
    } catch (error) {
      logger.error('Error deleting recipe:', error);
      setDeleteError(error instanceof Error ? error.message : 'Delete failed');
      setShowErrorAlert(true);
    }
  };

  // Stats
  const totalCount = recipes.length;
  const publishedCount = recipes.filter(r => r.isPublished).length;
  const draftCount = totalCount - publishedCount;

  const statusPills: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: `All (${totalCount})` },
    { key: 'published', label: `Published (${publishedCount})` },
    { key: 'draft', label: `Draft (${draftCount})` },
  ];

  const sortOptions: { key: SortField; label: string }[] = [
    { key: 'dateUpdated', label: 'Updated' },
    { key: 'dateAdded', label: 'Created' },
    { key: 'name', label: 'Name' },
    { key: 'isPublished', label: 'Status' },
  ];

  return (
    <AdminLayout title={i18n.t('admin.common.manageRecipes')} showBackButton={true}>
      {/* Toolbar */}
      <View className="px-lg pt-lg pb-md bg-white">
        {/* Stats */}
        <Text preset="body" className="text-text-default font-semibold mb-md">
          {totalCount} recipes
          <Text preset="body" style={{ color: COLORS.status.success }}> · {publishedCount} published</Text>
          {draftCount > 0 && (
            <Text preset="body" style={{ color: COLORS.status.warning }}> · {draftCount} drafts</Text>
          )}
        </Text>

        {/* Filter + sort + locale in one bar */}
        <View className="flex-row items-center bg-grey-light rounded-lg px-md py-sm mb-md flex-wrap gap-xs">
          {/* Status filter */}
          {statusPills.map(pill => (
            <Pressable
              key={pill.key}
              onPress={() => setStatusFilter(pill.key)}
              className={`px-sm py-xxs rounded-full ${statusFilter === pill.key ? 'bg-primary-default' : ''}`}
              style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}}
            >
              <Text
                preset="caption"
                className={statusFilter === pill.key ? 'text-text-default font-semibold' : 'text-text-secondary'}
              >
                {pill.label}
              </Text>
            </Pressable>
          ))}

          <View className="w-[1px] h-[18px] bg-grey-medium mx-xs" />

          {/* Sort */}
          {sortOptions.map(option => (
            <Pressable
              key={option.key}
              onPress={() => handleSortChange(option.key)}
              className={`flex-row items-center px-sm py-xxs rounded-full ${sortBy === option.key ? 'bg-primary-default' : ''}`}
              style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}}
            >
              <Text
                preset="caption"
                className={sortBy === option.key ? 'text-text-default font-semibold' : 'text-text-secondary'}
              >
                {option.label}
              </Text>
              {sortBy === option.key && (
                <Ionicons
                  name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={COLORS.text.default}
                  style={{ marginLeft: 2 }}
                />
              )}
            </Pressable>
          ))}

          <View className="w-[1px] h-[18px] bg-grey-medium mx-xs" />

          <AdminDisplayLocaleToggle value={displayLocale} onChange={setDisplayLocale} />
        </View>

        {/* Search + New */}
        <View className="flex-row items-center gap-sm">
          <View className="flex-1" style={{ marginBottom: -16 }}>
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              placeholder={i18n.t('admin.recipes.list.search')}
            />
          </View>
          <Pressable
            onPress={() => router.push('/admin/recipes/new')}
            className="flex-row items-center gap-xxs px-lg py-md border border-border-default rounded-full"
            style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}}
          >
            <Ionicons name="add" size={16} color={COLORS.text.default} />
            <Text preset="bodySmall" className="text-text-default">New</Text>
          </Pressable>
        </View>
      </View>

      {/* Recipe list */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={COLORS.primary.darkest} />
        </View>
      ) : (
        <FlatList
          data={filteredRecipes}
          extraData={displayLocale}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
          ItemSeparatorComponent={() => <View className="h-[1px] bg-border-default" />}
          renderItem={({ item }) => (
            <RecipeRow
              item={item}
              displayLocale={displayLocale}
              onPress={() => router.push(`/admin/recipes/${item.id}`)}
              onTogglePublish={() => handleTogglePublished(item)}
            />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center p-xl">
              <Ionicons name="restaurant-outline" size={48} color={COLORS.grey.medium} />
              <Text preset="body" className="text-text-secondary mt-sm">
                {i18n.t('admin.recipes.list.noRecipes')}
              </Text>
            </View>
          }
        />
      )}

      {/* Delete Confirmation */}
      <AlertModal
        visible={showDeleteConfirm}
        title={i18n.t('admin.recipes.list.deleteConfirm.title')}
        message={`${getTranslatedField(recipeToDelete?.translations, 'en', 'name') || ''}\n${i18n.t('admin.recipes.list.deleteConfirm.message')}`}
        onConfirm={confirmDeleteRecipe}
        onCancel={() => { setShowDeleteConfirm(false); setRecipeToDelete(null); }}
        confirmText={i18n.t('admin.recipes.list.deleteConfirm.confirm')}
        cancelText={i18n.t('common.cancel')}
        isDestructive={true}
      />

      <AlertModal
        visible={showErrorAlert}
        title={i18n.t('common.errors.title')}
        message={deleteError || i18n.t('common.errors.default')}
        onConfirm={() => setShowErrorAlert(false)}
        confirmText={i18n.t('common.ok')}
      />

      <AlertModal
        visible={showPublishConfirm}
        title={publishAction === 'publish'
          ? i18n.t('admin.recipes.publishConfirm.publishTitle')
          : i18n.t('admin.recipes.publishConfirm.unpublishTitle')}
        message={publishAction === 'publish'
          ? i18n.t('admin.recipes.publishConfirm.publishMessage', { name: getTranslatedField(recipeToPublish?.translations, 'en', 'name') || '' })
          : i18n.t('admin.recipes.publishConfirm.unpublishMessage', { name: getTranslatedField(recipeToPublish?.translations, 'en', 'name') || '' })}
        onConfirm={() => recipeToPublish && confirmTogglePublish(recipeToPublish.id, publishAction === 'unpublish')}
        onCancel={() => { setShowPublishConfirm(false); setRecipeToPublish(null); }}
        confirmText={publishAction === 'publish'
          ? i18n.t('admin.recipes.publishConfirm.publishConfirm')
          : i18n.t('admin.recipes.publishConfirm.unpublishConfirm')}
        cancelText={i18n.t('common.cancel')}
      />
    </AdminLayout>
  );
}

// =============================================================================
// Compact recipe row
// =============================================================================

function RecipeRow({ item, displayLocale, onPress, onTogglePublish }: {
  item: AdminRecipe;
  displayLocale: string;
  onPress: () => void;
  onTogglePublish: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <Pressable
      className="flex-row items-center py-sm"
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        { backgroundColor: hovered ? COLORS.grey.lightest : 'transparent' },
        Platform.OS === 'web' ? { cursor: 'pointer' } as any : {},
      ]}
    >
      {/* Status dot */}
      <View
        className="rounded-full mr-sm"
        style={{
          width: 8,
          height: 8,
          backgroundColor: item.isPublished ? COLORS.status.success : COLORS.grey.medium,
        }}
      />

      {/* Image */}
      <Image
        source={item.pictureUrl ? { uri: item.pictureUrl } : require('@/assets/images/backgrounds/watercolour-circle.png')}
        style={{ width: 40, height: 40, borderRadius: 6, marginRight: 12 }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />

      {/* Name */}
      <Text preset="body" className="flex-1 text-text-default" numberOfLines={1}>
        {getTranslatedField(item.translations, displayLocale, 'name')}
      </Text>

      {/* Publish toggle */}
      <Switch
        value={item.isPublished}
        onValueChange={onTogglePublish}
        trackColor={{ false: COLORS.grey.medium, true: COLORS.status.success }}
        thumbColor={COLORS.neutral.white}
      />
    </Pressable>
  );
}
