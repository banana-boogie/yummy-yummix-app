import React, { useState, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/form/TextInput';
import { AlertModal } from '@/components/common/AlertModal';
import { adminRecipeTagService } from '@/services/admin/adminRecipeTagService';
import { Ionicons, Feather } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { TagEditModal } from '@/components/admin/tags/TagEditModal';
import i18n from '@/i18n';
import { AdminRecipeTag } from '@/types/recipe.admin.types';
import { formatCategoryNameToTitleCase } from '@/utils/formatters';
import { useDevice } from '@/hooks/useDevice';

export default function AdminTags() {
  const { isPhone } = useDevice();
  const [tags, setTags] = useState<AdminRecipeTag[]>([]);
  const [filteredTags, setFilteredTags] = useState<AdminRecipeTag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedTag, setSelectedTag] = useState<AdminRecipeTag | null>();
  const [isNewTag, setIsNewTag] = useState(false);
  const [newCategoryModalVisible, setNewCategoryModalVisible] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTags(tags);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredTags(
        tags.filter(
          tag =>
            tag.nameEn.toLowerCase().includes(query) ||
            tag.nameEs.toLowerCase().includes(query) ||
            (tag.categories && tag.categories.some(category => category.toLowerCase().includes(query)))
        )
      );
    }
  }, [searchQuery, tags]);

  const fetchTags = async () => {
    setIsLoading(true);
    try {
      const tagData = await adminRecipeTagService.getAllTags();
      tagData.forEach(tag => {
        tag.categories = tag.categories.map(formatCategoryNameToTitleCase);
      });

      setTags(tagData);
      setFilteredTags(tagData);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTag = (tag: AdminRecipeTag) => {
    setSelectedTag(tag);
    setIsNewTag(false);
    setEditModalVisible(true);
  };

  const handleAddNewTag = () => {
    setSelectedTag(null);
    setIsNewTag(true);
    setEditModalVisible(true);
  };

  const handleDeleteTag = (tag: AdminRecipeTag) => {
    setSelectedTag(tag);
    setDeleteModalVisible(true);
  };

  const confirmDeleteTag = async () => {
    if (!selectedTag) return;

    try {
      await adminRecipeTagService.deleteTag(selectedTag.id);

      setTags(prev => prev.filter(tag => tag.id !== selectedTag.id));
      setDeleteModalVisible(false);
    } catch (error) {
      console.error('Failed to delete tag:', error);
    }
  };

  const handleSaveTag = async (updatedTag: AdminRecipeTag, isNew: boolean) => {
    try {

      if (isNew) {
        setTags(prev => [...prev, updatedTag]);
      } else {
        setTags(prev =>
          prev.map(tag => (tag.id === updatedTag.id ? updatedTag : tag))
        );
      }

      setEditModalVisible(false);
    } catch (error) {
      console.error(`Failed to ${isNew ? 'create' : 'update'} tag:`, error);
    }
  };

  const handleAddNewCategory = () => {
    setNewCategory('');
    setNewCategoryModalVisible(true);
  };

  const handleSaveCategory = async () => {
    if (!newCategory.trim()) return;

    try {
      await adminRecipeTagService.createCategory(newCategory.trim());
      setNewCategoryModalVisible(false);
      setNewCategory('');
      fetchTags();
    } catch (error) {
      console.error('Failed to create category:', error);
    }
  };

  // Mobile tag card - vertical layout
  const renderMobileTagCard = ({ item }: { item: AdminRecipeTag }) => (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      {/* Names */}
      <View className="mb-sm">
        <Text preset="body" className="font-semibold">{item.nameEn}</Text>
        <Text preset="caption" color={COLORS.text.secondary}>{item.nameEs}</Text>
      </View>

      {/* Categories */}
      {item.categories && item.categories.length > 0 && (
        <View className="flex-row flex-wrap gap-xs mb-md">
          {item.categories.map((category, index) => (
            <View
              key={`${item.id}-${category}-${index}`}
              className="py-xs px-sm rounded-full bg-primary-light"
            >
              <Text preset="caption" color={COLORS.text.secondary}>{category}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View className="flex-row justify-end gap-md border-t border-border-default pt-sm">
        <TouchableOpacity
          className="flex-row items-center p-sm"
          onPress={() => handleEditTag(item)}
        >
          <Feather name="edit" size={18} color={COLORS.text.default} />
          <Text preset="caption" className="ml-xs" color={COLORS.text.default}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-row items-center p-sm"
          onPress={() => handleDeleteTag(item)}
        >
          <Feather name="trash-2" size={18} color={COLORS.status.error} />
          <Text preset="caption" className="ml-xs" color={COLORS.status.error}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Desktop tag row - horizontal table layout
  const renderDesktopTagRow = ({ item }: { item: AdminRecipeTag }) => (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 16,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        flexDirection: 'row',
        alignItems: 'center'
      }}
    >
      <View className="w-[200px] pr-md">
        <Text preset="body">{item.nameEs}</Text>
      </View>
      <View className="w-[200px] pr-md">
        <Text preset="body">{item.nameEn}</Text>
      </View>
      <View className="flex-1 flex-row flex-wrap gap-xs">
        {item.categories && item.categories.map((category, index) => (
          <View
            key={`${item.id}-${category}-${index}`}
            className="py-xs px-sm rounded-full bg-primary-light"
          >
            <Text preset="caption" color={COLORS.text.secondary}>{category}</Text>
          </View>
        ))}
      </View>
      <View className="flex-row items-center gap-sm">
        <TouchableOpacity
          className="p-sm"
          onPress={() => handleEditTag(item)}
        >
          <Feather name="edit" size={18} color={COLORS.text.default} />
        </TouchableOpacity>
        <TouchableOpacity
          className="p-sm"
          onPress={() => handleDeleteTag(item)}
        >
          <Feather name="trash-2" size={18} color={COLORS.status.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <AdminLayout title={i18n.t('admin.common.tags')}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Search and Add Row - stacked on mobile */}
        <View className={`${isPhone ? 'flex-col gap-md' : 'flex-row justify-between items-center'} mb-lg`}>
          <View className={isPhone ? 'w-full' : 'flex-1 max-w-[400px]'}>
            <TextInput
              placeholder={i18n.t('admin.tags.searchPlaceholder')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              leftIcon={<Ionicons name="search" size={20} color={COLORS.grey.MEDIUM} />}
            />
          </View>
          <View className={`flex-row ${isPhone ? 'justify-between' : ''} gap-sm`}>
            <Button
              size="small"
              variant="outline"
              label={isPhone ? 'Category' : i18n.t('admin.tags.addNewCategory')}
              onPress={handleAddNewCategory}
              icon={<Ionicons name="add-circle-outline" size={14} color={COLORS.text.default} />}
            />
            <Button
              size="small"
              label={isPhone ? 'Tag' : i18n.t('admin.tags.addNew')}
              onPress={handleAddNewTag}
              icon={<Ionicons name="add" size={18} color={COLORS.neutral.WHITE} />}
            />
          </View>
        </View>

        {/* Desktop Table Header - hidden on mobile */}
        {!isPhone && (
          <View className="flex-row items-center p-md bg-primary-light rounded-lg mb-sm">
            <View className="w-[150px] pr-md">
              <Text fontWeight="600">{i18n.t('admin.tags.spanishName')}</Text>
            </View>
            <View className="w-[150px] pr-md">
              <Text fontWeight="600">{i18n.t('admin.tags.englishName')}</Text>
            </View>
            <View className="flex-1">
              <Text fontWeight="600">{i18n.t('admin.tags.categories')}</Text>
            </View>
            <View className="w-[80px] items-end">
              <Text fontWeight="600">{i18n.t('admin.common.actions')}</Text>
            </View>
          </View>
        )}

        {/* Tags List */}
        {isLoading ? (
          <View className="flex-1 justify-center items-center py-xxxl">
            <Text>{i18n.t('common.loading')}</Text>
          </View>
        ) : filteredTags.length === 0 ? (
          <View className="flex-1 justify-center items-center py-xxxl">
            <Ionicons name="pricetags-outline" size={48} color={COLORS.grey.MEDIUM} />
            <Text className="mt-md" color={COLORS.text.secondary}>{i18n.t('admin.tags.noTagsFound')}</Text>
          </View>
        ) : (
          <FlatList
            data={filteredTags}
            renderItem={isPhone ? renderMobileTagCard : renderDesktopTagRow}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        )}
      </ScrollView>

      {/* Edit Tag Modal */}
      <TagEditModal
        visible={editModalVisible}
        tag={selectedTag}
        isNew={isNewTag}
        onClose={() => setEditModalVisible(false)}
        onSave={handleSaveTag}
      />

      {/* Delete Confirmation Modal */}
      <AlertModal
        visible={deleteModalVisible}
        title={i18n.t('admin.tags.deleteTitle')}
        message={i18n.t('admin.tags.deleteMessage')}
        confirmText={i18n.t('common.delete')}
        cancelText={i18n.t('common.cancel')}
        onConfirm={confirmDeleteTag}
        onCancel={() => setDeleteModalVisible(false)}
        isDestructive={true}
      />

      {/* New Category Modal */}
      <AlertModal
        visible={newCategoryModalVisible}
        title={i18n.t('admin.tags.newCategoryTitle')}
        message={
          <View className="my-md w-full">
            <TextInput
              value={newCategory}
              onChangeText={setNewCategory}
              autoFocus
            />
          </View>
        }
        confirmText={i18n.t('common.save')}
        cancelText={i18n.t('common.cancel')}
        onConfirm={handleSaveCategory}
        onCancel={() => setNewCategoryModalVisible(false)}
      />
    </AdminLayout>
  );
}