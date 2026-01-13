import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { TextInput } from '@/components/form/TextInput';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';
import { adminRecipeTagService } from '@/services/admin/adminRecipeTagService';
import { AdminRecipeTag } from '@/types/recipe.admin.types';
import { MultiSelect } from '@/components/form/MultiSelect';
import { AlertModal } from '@/components/common/AlertModal';
import { Text } from '@/components/common/Text';
import { LanguageBadge } from '@/components/common/LanguageBadge';
import { useDevice } from '@/hooks/useDevice';

// Local filters interface with categories
interface LocalFilters {
  categories: string[];
  searchQuery: string;
  sortDirection: 'asc' | 'desc';
}

export interface RecipeTagOption {
  id: string;
  name: string;
  nameEn: string;
  nameEs: string;
  categories: string[];
}

interface TagSelectorProps {
  selectedTags: RecipeTagOption[];
  onTagsChange: (tags: RecipeTagOption[]) => void;
}

export function TagSelector({ selectedTags, onTagsChange }: TagSelectorProps) {
  const { isMobile } = useDevice();

  // State
  const [loading, setLoading] = useState(false);
  const [allTags, setAllTags] = useState<AdminRecipeTag[]>([]);
  const [filteredTags, setFilteredTags] = useState<AdminRecipeTag[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filters, setFilters] = useState<LocalFilters>({
    categories: [],
    searchQuery: '',
    sortDirection: 'asc'
  });
  const [error, setError] = useState<string | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Fetch tags and categories on mount only
  useEffect(() => {
    fetchCategories();
    fetchAllTags();
  }, []);

  // Apply client-side filtering when filters change
  useEffect(() => {
    applyFilters();
  }, [filters, allTags]);

  const fetchCategories = async () => {
    try {
      const fetchedCategories = await adminRecipeTagService.getTagCategories();
      setCategories(fetchedCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setAlertMessage('Failed to load tag categories');
      setShowAlert(true);
    }
  };

  const fetchAllTags = async () => {
    setLoading(true);
    try {
      // Fetch all tags at once, without filters
      const fetchedTags = await adminRecipeTagService.getAllTags();
      setAllTags(fetchedTags);
    } catch (error: any) {
      console.error('Error fetching tags:', error);
      setError(error.message || 'Failed to fetch tags');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    if (!allTags.length) return;

    let result = [...allTags];

    // Apply category filtering (client-side)
    const selectedCategories = filters.categories || [];
    if (selectedCategories.length > 0) {
      result = result.filter(tag =>
        tag.categories.some((category: string) => selectedCategories.includes(category))
      );
    }

    // Apply search filtering 
    if (filters.searchQuery) {
      const searchTerm = filters.searchQuery.toLowerCase();
      result = result.filter(tag =>
        tag.nameEn.toLowerCase().includes(searchTerm) ||
        tag.nameEs.toLowerCase().includes(searchTerm)
      );
    }

    // Apply client-side sorting 
    result.sort((a, b) => {
      const sortField = 'nameEs'; // Sort by Spanish name
      const valueA = a[sortField].toLowerCase();
      const valueB = b[sortField].toLowerCase();

      if (filters.sortDirection === 'asc') {
        return valueA.localeCompare(valueB);
      } else {
        return valueB.localeCompare(valueA);
      }
    });

    setFilteredTags(result);
  };

  const toggleTagSelection = (tag: AdminRecipeTag) => {
    const isSelected = selectedTags.some(t => t.id === tag.id);

    if (isSelected) {
      onTagsChange(selectedTags.filter(t => t.id !== tag.id));
    } else {
      onTagsChange([...selectedTags, {
        id: tag.id,
        name: tag.nameEn,
        nameEn: tag.nameEn,
        nameEs: tag.nameEs,
        categories: tag.categories
      }]);
    }
  };

  const toggleSortDirection = () => {
    setFilters(prev => ({
      ...prev,
      sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc'
    }));
  };

  const clearFilters = () => {
    setFilters(prev => ({
      ...prev,
      categories: [],
      searchQuery: ''
    }));
  };

  const hasActiveFilters = (filters.categories && filters.categories.length > 0) || filters.searchQuery;

  // Replace search handler with simpler version that just updates filters
  const handleSearchChange = (text: string) => {
    setFilters(prev => ({ ...prev, searchQuery: text }));
  };

  return (
    <View className="flex-1">
      {/* Selected tags */}
      <View className="mb-md">
        <Text preset="subheading" className="mt-lg mb-sm">
          {i18n.t('admin.recipes.form.tagsInfo.selectedTags')}
        </Text>

        {selectedTags.length === 0 ? (
          <Text className="text-center text-text-SECONDARY italic p-md">
            {i18n.t('admin.recipes.form.tagsInfo.noTagsSelected')}
          </Text>
        ) : (
          <View className="flex-row flex-wrap gap-sm mt-xs">
            {selectedTags.map(tag => (
              <View
                key={tag.id}
                className="bg-primary-default rounded-lg p-sm border border-primary-dark"
              >
                <View className="flex-row items-center justify-between mb-xs">
                  <Text preset="body" fontWeight="700" className="text-text-default">
                    {tag.nameEn || 'Unnamed Tag'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => toggleTagSelection(tag as unknown as AdminRecipeTag)}
                    className="ml-sm"
                  >
                    <Ionicons name="close-circle" size={20} className="text-primary-dark" />
                  </TouchableOpacity>
                </View>
                <Text preset="caption" className="text-text-secondary">
                  {tag.nameEs || 'Sin nombre'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Available tags */}
      <Text preset="subheading" className="mb-sm">
        {i18n.t('admin.recipes.form.tagsInfo.availableTags')}
      </Text>


      {/* Filters */}
      <View className="mb-md">
        <View className="mb-sm">
          <TextInput
            value={filters.searchQuery}
            onChangeText={handleSearchChange}
            placeholder={i18n.t('admin.recipes.form.tagsInfo.searchTags')}
            leftIcon={<Ionicons name="search" size={20} className="text-text-SECONDARY" />}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>

        <View className="flex-row items-center gap-sm">
          <View className="flex-1">
            <MultiSelect
              selectedValues={filters.categories || []}
              options={categories.map(cat => ({
                label: cat,
                value: cat
              }))}
              onValueChange={(values) => setFilters(prev => ({ ...prev, categories: values }))}
              placeholder={i18n.t('admin.recipes.form.tagsInfo.selectCategories')}
              containerStyle={{ marginBottom: 0 }}
            />
          </View>

          <TouchableOpacity
            className="p-sm bg-background-SECONDARY rounded-md"
            onPress={toggleSortDirection}
          >
            <Ionicons
              name={filters.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
              size={20}
              className="text-text-DEFAULT"
            />
          </TouchableOpacity>
        </View>

        {hasActiveFilters ? (
          <TouchableOpacity
            className="flex-row items-center self-start mt-xs p-xs bg-background-SECONDARY rounded-lg"
            onPress={clearFilters}
          >
            <Ionicons name="close-circle" size={16} className="text-text-SECONDARY" />
            <Text className="ml-xxs text-text-SECONDARY text-sm">
              {i18n.t('admin.recipes.form.tagsInfo.clearFilters')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator size="large" className="my-xl text-primary-DEFAULT" />
      ) : error ? (
        <Text className="text-center text-primary-DEFAULT italic p-md">{error}</Text>
      ) : (
        <View className="bg-background-DEFAULT rounded-lg overflow-hidden border border-border-DEFAULT">
          {!isMobile && (
            <View className="flex-row bg-background-SECONDARY py-md px-lg border-b border-border-DEFAULT">
              <View className="flex-[0.5]" />
              <Text className="flex-[2] text-text-SECONDARY font-bold text-sm">
                {i18n.t('admin.recipes.form.tagsInfo.spanishName')}
              </Text>
              <Text className="flex-[2] text-text-SECONDARY font-bold text-sm">
                {i18n.t('admin.recipes.form.tagsInfo.englishName')}
              </Text>
              <Text className="flex-[3] text-text-SECONDARY font-bold text-sm">
                {i18n.t('admin.recipes.form.tagsInfo.categories')}
              </Text>
            </View>
          )}

          {filteredTags.map(tag => {
            const isSelected = selectedTags.some(t => t.id === tag.id);
            return (
              <TouchableOpacity
                key={tag.id}
                className={`border-b border-border-DEFAULT ${isSelected ? 'bg-primary-default' : 'bg-background-DEFAULT'}`}
                onPress={() => toggleTagSelection(tag)}
              >
                {isMobile ? (
                  /* Mobile Card Layout */
                  <View className="p-md">
                    <View className="flex-row items-center mb-sm">
                      {isSelected ? (
                        <View className="w-6 h-6 rounded-full bg-white border-2 border-primary-dark items-center justify-center mr-sm">
                          <Ionicons name="checkmark" size={14} className="text-primary-dark" />
                        </View>
                      ) : (
                        <View className="w-6 h-6 rounded-full border-2 border-border-DEFAULT bg-background-DEFAULT mr-sm" />
                      )}
                      <View className="flex-1">
                        <Text className={`text-base font-bold ${isSelected ? 'text-text-default' : ''}`}>
                          {tag.nameEn}
                        </Text>
                        <Text className={`text-sm ${isSelected ? 'text-text-secondary' : 'text-text-secondary'}`}>
                          {tag.nameEs}
                        </Text>
                      </View>
                    </View>
                    {tag.categories.length > 0 && (
                      <View className="flex-row flex-wrap gap-xs ml-9">
                        {tag.categories.map((cat, idx) => (
                          <View
                            key={idx}
                            className={`px-xs py-xxs rounded-sm ${isSelected ? 'bg-white/30' : 'bg-background-SECONDARY'}`}
                          >
                            <Text className={`text-xs ${isSelected ? 'text-text-default' : 'text-text-secondary'}`}>
                              {cat}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  /* Desktop Table Row Layout */
                  <View className="flex-row items-center py-md px-lg">
                    <View className="flex-[0.5] items-center">
                      {isSelected ? (
                        <View className="w-6 h-6 rounded-full bg-background-DEFAULT border border-primary-DEFAULT items-center justify-center">
                          <Ionicons name="checkmark" size={16} className="text-primary-DARK" />
                        </View>
                      ) : (
                        <View className="w-6 h-6 rounded-full border border-border-DEFAULT" />
                      )}
                    </View>
                    <Text className="flex-[2] px-xs text-base">{tag.nameEs}</Text>
                    <Text className="flex-[2] px-xs text-base">{tag.nameEn}</Text>
                    <Text className="flex-[3] px-xs text-base">
                      {tag.categories.join(', ')}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {filteredTags.length === 0 ? (
            <Text className="text-center text-text-SECONDARY italic p-md">
              {i18n.t('admin.recipes.form.tagsInfo.noTagsFound')}
            </Text>
          ) : null}
        </View>
      )}

      <AlertModal
        visible={showAlert}
        title="Error"
        message={alertMessage}
        onConfirm={() => setShowAlert(false)}
        confirmText="OK"
      />
    </View>
  );
}