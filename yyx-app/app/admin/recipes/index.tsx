import React, { useEffect, useState } from 'react';
import { View, ScrollView, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Switch } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import adminRecipeService from '@/services/admin/adminRecipeService';
import { AdminRecipe } from '@/types/recipe.admin.types';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AlertModal } from '@/components/common/AlertModal';
import i18n from '@/i18n';
import { useDevice } from '@/hooks/useDevice';

export default function RecipesAdminPage() {
  const router = useRouter();
  const { isPhone } = useDevice();
  const [recipes, setRecipes] = useState<AdminRecipe[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<AdminRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    published: 'all', // 'all', 'published', 'draft'
  });
  const [sortBy, setSortBy] = useState('dateUpdated'); // options: 'name', 'isPublished', 'dateAdded', 'dateUpdated'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState<AdminRecipe | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [publishAction, setPublishAction] = useState<'publish' | 'unpublish'>('publish');
  const [recipeToPublish, setRecipeToPublish] = useState<AdminRecipe | null>(null);

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const recipes = await adminRecipeService.getAllRecipesForAdmin();
      setRecipes(recipes);
      setFilteredRecipes(recipes);
    } catch (error) {
      console.error('Error fetching recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Apply filters whenever recipes, searchQuery, or filters change
    let filtered = [...recipes];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(recipe =>
        recipe.nameEs?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        recipe.nameEn?.toLowerCase().includes(searchQuery.toLowerCase())

      );
    }

    // Apply published/draft filter
    if (filters.published === 'published') {
      filtered = filtered.filter(recipe => recipe.isPublished);
    } else if (filters.published === 'draft') {
      filtered = filtered.filter(recipe => !recipe.isPublished);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = (a.nameEn || '').localeCompare(b.nameEn || '');
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
  }, [recipes, searchQuery, filters, sortBy, sortDirection]);

  const handleTogglePublished = async (recipe: AdminRecipe) => {
    setRecipeToPublish(recipe);
    setPublishAction(recipe.isPublished ? 'unpublish' : 'publish');
    setShowPublishConfirm(true);
  };

  const confirmTogglePublish = async (id: string, currentStatus: boolean) => {
    try {
      await adminRecipeService.toggleRecipePublished(id, !currentStatus);
      const updatedRecipes = recipes.map(recipe =>
        recipe.id === id ? { ...recipe, isPublished: !currentStatus } : recipe
      );
      setRecipes(updatedRecipes);
    } catch (error) {
      console.error('Error toggling recipe publish status:', error);
    } finally {
      setShowPublishConfirm(false);
      setRecipeToPublish(null);
    }
  };

  const toggleSortDirection = () => {
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  };

  const handleSortChange = (newSortBy: string) => {
    if (sortBy === newSortBy) {
      toggleSortDirection();
    } else {
      setSortBy(newSortBy);
      setSortDirection('desc'); // Default to descending when changing sort field
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
      // Update the local state
      const updatedRecipes = recipes.filter(recipe => recipe.id !== recipeToDelete.id);
      setRecipes(updatedRecipes);
      setShowDeleteConfirm(false);
      setRecipeToDelete(null);
    } catch (error) {
      console.error('Error deleting recipe:', error);
      setDeleteError(error instanceof Error ? error.message : i18n.t('admin.recipes.errors.publishFailed'));
      setShowErrorAlert(true);
    }
  };

  const renderRecipeItem = ({ item }: { item: AdminRecipe }) => (
    <View className="bg-white rounded-lg p-md mb-md shadow-md">
      {/* Mobile: Stacked layout, Desktop: Row layout */}
      <View className={isPhone ? 'flex-col' : 'flex-row justify-between items-center'}>
        {/* Recipe info - image and names */}
        <View className="flex-row items-center flex-1 mb-sm gap-sm">
          <Image
            source={item.pictureUrl ? { uri: item.pictureUrl } : require('@/assets/images/backgrounds/watercolour-circle.png')}
            className={isPhone ? 'w-[40px] h-[40px]' : 'w-[50px] h-[50px]'}
            style={{ borderRadius: 8 }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <View className="flex-col flex-1">
            <Text preset="body" numberOfLines={1}>{item.nameEn}</Text>
            <Text preset="caption" color={COLORS.text.secondary} numberOfLines={1}>{item.nameEs}</Text>
          </View>
        </View>

        {/* Actions row */}
        <View className="flex-row items-center justify-between gap-sm">
          {/* Status badge */}
          <View className="flex-row items-center mr-sm">
            <Ionicons
              name={item.isPublished ? "checkmark-circle" : "time"}
              size={16}
              color={item.isPublished ? COLORS.status.SUCCESS : COLORS.status.WARNING}
            />
            <Text preset="caption" className="ml-xs" color={item.isPublished ? COLORS.status.SUCCESS : COLORS.status.WARNING}>
              {item.isPublished ? 'Published' : 'Draft'}
            </Text>
          </View>

          {/* Switch */}
          <View className="border border-primary-dark rounded-full p-[2px]">
            <Switch
              value={item.isPublished}
              onValueChange={() => handleTogglePublished(item)}
              trackColor={{ false: COLORS.grey.MEDIUM, true: COLORS.status.SUCCESS }}
              thumbColor={COLORS.neutral.WHITE}
            />
          </View>

          {/* Edit button */}
          <TouchableOpacity
            className="p-sm"
            onPress={() => router.push(`/admin/recipes/${item.id}`)}
          >
            <Ionicons name="create-outline" size={20} color={COLORS.text.default} />
          </TouchableOpacity>

          {/* Delete button */}
          <TouchableOpacity
            className="p-sm"
            onPress={() => handleDeleteRecipe(item)}
          >
            <Ionicons name="trash-outline" size={20} color={COLORS.status.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <AdminLayout title="Manage Recipes" showBackButton={true}>
      <ScrollView className="flex-1">
        <View className="flex-row items-center justify-between px-md py-sm border-b border-border-default">
          <Text className="text-xl font-bold text-text-default">Recipes</Text>
          <TouchableOpacity
            className="flex-row items-center bg-primary-default px-md py-sm rounded-lg shadow-md"
            onPress={() => router.push('/admin/recipes/new')}
          >
            <Ionicons name="add" size={24} color={COLORS.neutral.WHITE} />
            <Text color={COLORS.neutral.WHITE} className="ml-sm font-bold">New Recipe</Text>
          </TouchableOpacity>
        </View>

        <View className="px-md bg-background-default">
          <View className="flex-row items-center px-md rounded-lg mb-sm">
            <Ionicons name="search" size={20} color={COLORS.grey.MEDIUM} />
            <TextInput
              className="flex-1 py-md px-sm text-text-default"
              placeholder="Search recipes..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={COLORS.grey.MEDIUM}
            />
          </View>

          <View className="mb-sm">
            <View className="flex-row items-center flex-wrap mb-sm">
              <Text className="mr-sm text-text-SECONDARY font-bold">Status:</Text>
              <TouchableOpacity
                className={`px-md py-sm rounded-sm mr-sm mb-sm ${filters.published === 'all' ? 'bg-primary-default' : ''}`}
                onPress={() => setFilters({ ...filters, published: 'all' })}
              >
                <Text className={filters.published === 'all' ? 'text-white' : 'text-text-SECONDARY'}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-md py-sm rounded-sm mr-sm mb-sm ${filters.published === 'published' ? 'bg-primary-default' : ''}`}
                onPress={() => setFilters({ ...filters, published: 'published' })}
              >
                <Text className={filters.published === 'published' ? 'text-white' : 'text-text-SECONDARY'}>Published</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-md py-sm rounded-sm mr-sm mb-sm ${filters.published === 'draft' ? 'bg-primary-default' : ''}`}
                onPress={() => setFilters({ ...filters, published: 'draft' })}
              >
                <Text className={filters.published === 'draft' ? 'text-white' : 'text-text-SECONDARY'}>Draft</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center flex-wrap mb-sm">
              <Text className="mr-sm text-text-SECONDARY font-bold">Sort by:</Text>
              <TouchableOpacity
                className={`px-md py-sm rounded-sm mr-sm mb-sm ${sortBy === 'name' ? 'bg-primary-default' : ''}`}
                onPress={() => handleSortChange('name')}
              >
                <View className="flex-row items-center">
                  <Text className={sortBy === 'name' ? 'text-white' : 'text-text-SECONDARY'}>
                    Name
                  </Text>
                  {sortBy === 'name' && (
                    <Ionicons
                      name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                      size={14}
                      color={COLORS.neutral.WHITE}
                      className="ml-xs"
                    />
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-md py-sm rounded-sm mr-sm mb-sm ${sortBy === 'isPublished' ? 'bg-primary-default' : ''}`}
                onPress={() => handleSortChange('isPublished')}
              >
                <View className="flex-row items-center">
                  <Text className={sortBy === 'isPublished' ? 'text-white' : 'text-text-SECONDARY'}>
                    Status
                  </Text>
                  {sortBy === 'isPublished' && (
                    <Ionicons
                      name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                      size={14}
                      color={COLORS.neutral.WHITE}
                      className="ml-xs"
                    />
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-md py-sm rounded-sm mr-sm mb-sm ${sortBy === 'dateAdded' ? 'bg-primary-default' : ''}`}
                onPress={() => handleSortChange('dateAdded')}
              >
                <View className="flex-row items-center">
                  <Text className={sortBy === 'dateAdded' ? 'text-white' : 'text-text-SECONDARY'}>
                    Date Added
                  </Text>
                  {sortBy === 'dateAdded' && (
                    <Ionicons
                      name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                      size={14}
                      color={COLORS.neutral.WHITE}
                      className="ml-xs"
                    />
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-md py-sm rounded-sm mr-sm mb-sm ${sortBy === 'dateUpdated' ? 'bg-primary-default' : ''}`}
                onPress={() => handleSortChange('dateUpdated')}
              >
                <View className="flex-row items-center">
                  <Text className={sortBy === 'dateUpdated' ? 'text-white' : 'text-text-SECONDARY'}>
                    Date Updated
                  </Text>
                  {sortBy === 'dateUpdated' && (
                    <Ionicons
                      name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                      size={14}
                      color={COLORS.neutral.WHITE}
                      className="ml-xs"
                    />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color={COLORS.primary.DARKEST} />
          </View>
        ) : (
          <FlatList
            data={filteredRecipes}
            renderItem={renderRecipeItem}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            scrollEnabled={false}
            ListEmptyComponent={
              <View className="items-center justify-center p-xl">
                <Ionicons name="restaurant-outline" size={48} color={COLORS.grey.MEDIUM} />
                <Text className="mt-md text-text-SECONDARY text-base">No recipes found</Text>
              </View>
            }
          />
        )}

        {/* Delete Confirmation Modal */}
        <AlertModal
          visible={showDeleteConfirm}
          title={`${i18n.t('admin.recipes.list.deleteConfirm.title')} \n\n ${recipeToDelete?.nameEn} \n ${recipeToDelete?.nameEs}`}
          message={i18n.t('admin.recipes.list.deleteConfirm.message')}
          onConfirm={confirmDeleteRecipe}
          onCancel={() => setShowDeleteConfirm(false)}
          confirmText={i18n.t('admin.recipes.list.deleteConfirm.confirm')}
          cancelText={i18n.t('admin.recipes.list.deleteConfirm.cancel')}
          isDestructive={true}
        />

        {/* Error Alert */}
        <AlertModal
          visible={showErrorAlert}
          title={i18n.t('common.errors.title')}
          message={deleteError || i18n.t('common.errors.default')}
          onConfirm={() => setShowErrorAlert(false)}
          confirmText={i18n.t('common.ok')}
        />

        {/* Publish Confirmation Modal */}
        <AlertModal
          visible={showPublishConfirm}
          title={publishAction === 'publish' ? "Publish Recipe?" : "Unpublish Recipe?"}
          message={`Are you sure you want to ${publishAction} "${recipeToPublish?.nameEn}"? ${publishAction === 'publish' ? 'This will make it visible to all users.' : 'This will hide it from users.'}`}
          onConfirm={() => recipeToPublish && confirmTogglePublish(recipeToPublish.id, publishAction === 'unpublish')}
          onCancel={() => {
            setShowPublishConfirm(false);
            setRecipeToPublish(null);
          }}
          confirmText={publishAction === 'publish' ? "Publish" : "Unpublish"}
          cancelText={i18n.t('common.cancel')}
        />
      </ScrollView>
    </AdminLayout>
  );
}
