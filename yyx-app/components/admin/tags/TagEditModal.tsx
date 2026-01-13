import React, { useState, useEffect } from 'react';
import { View, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/form/TextInput';
import { FormSection } from '@/components/form/FormSection';
import { FormRow } from '@/components/form/FormRow';
import { FormGroup } from '@/components/form/FormGroup';
import { AdminRecipeTag } from '@/types/recipe.admin.types';
import { COLORS } from '@/constants/design-tokens';
import { adminRecipeTagService } from '@/services/admin/adminRecipeTagService';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';

interface TagEditModalProps {
  visible: boolean;
  tag?: AdminRecipeTag | null;
  isNew: boolean;
  onClose: () => void;
  onSave: (tag: AdminRecipeTag, isNew: boolean) => void;
}

export function TagEditModal({ visible, tag, isNew, onClose, onSave }: TagEditModalProps) {
  const [nameEn, setNameEn] = useState('');
  const [nameEs, setNameEs] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ nameEn?: string; nameEs?: string }>({});

  useEffect(() => {
    if (visible) {
      // Reset form when modal opens
      if (isNew) {
        setNameEn('');
        setNameEs('');
        setSelectedCategories([]);
      } else if (tag) {
        setNameEn(tag.nameEn);
        setNameEs(tag.nameEs);
        setSelectedCategories(tag.categories || []);
      }

      // Fetch available categories
      fetchCategories();
    }
  }, [visible, tag, isNew]);

  useEffect(() => {
    if (categorySearch.trim() === '') {
      setFilteredCategories(availableCategories);
    } else {
      const query = categorySearch.toLowerCase();
      setFilteredCategories(
        availableCategories.filter(category =>
          category.toLowerCase().includes(query)
        )
      );
    }
  }, [categorySearch, availableCategories]);

  const fetchCategories = async () => {
    try {
      const categories = await adminRecipeTagService.getTagCategories();
      setAvailableCategories(categories);
      setFilteredCategories(categories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(prev => prev.filter(cat => cat !== category));
    } else {
      setSelectedCategories(prev => [...prev, category]);
    }
  };

  const removeCategory = (category: string) => {
    setSelectedCategories(prev => prev.filter(cat => cat !== category));
  };

  const validateForm = (): boolean => {
    const newErrors: { nameEn?: string; nameEs?: string } = {};

    if (!nameEn.trim() && !nameEs.trim()) {
      newErrors.nameEn = i18n.t('validation.required');
      newErrors.nameEs = i18n.t('validation.required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const tagData = {
      nameEn: nameEn.trim(),
      nameEs: nameEs.trim(),
      categories: selectedCategories,
    };

    try {
      let savedTag;
      if (isNew) {
        savedTag = await adminRecipeTagService.createTag(tagData);
      } else if (tag?.id) {
        savedTag = await adminRecipeTagService.updateTag(tag.id, tagData);
      }

      if (savedTag) {
        onSave(savedTag, isNew);
      }
    } catch (error) {
      console.error('Error saving tag:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50" style={{ padding: 8 }}>
        <View
          className="bg-white rounded-xl w-full max-h-[95%]"
          style={{
            maxWidth: 800,
          }}
        >
          <View className="flex-row justify-between items-center p-lg border-b border-border-default">
            <Text preset="h1">
              {isNew ? i18n.t('admin.tags.createTitle') : i18n.t('admin.tags.editTitle')}
            </Text>
            <TouchableOpacity onPress={onClose} className="p-sm">
              <Ionicons name="close" size={24} color={COLORS.text.default} />
            </TouchableOpacity>
          </View>

          <ScrollView className="p-lg">
            {/* Names Section */}
            <FormSection title={i18n.t('admin.tags.basicInfo')} className="mb-xl">
              <FormRow>
                <FormGroup
                  label={i18n.t('admin.tags.englishName')}
                  error={errors.nameEn}
                >
                  <TextInput
                    value={nameEn}
                    onChangeText={setNameEn}
                  />
                </FormGroup>
                <FormGroup
                  label={i18n.t('admin.tags.spanishName')}
                  error={errors.nameEs}
                >
                  <TextInput
                    value={nameEs}
                    onChangeText={setNameEs}
                  />
                </FormGroup>
              </FormRow>
            </FormSection>

            {/* Categories Section */}
            <FormSection title={i18n.t('admin.tags.categories')} className="mb-xl">
              {/* Selected Categories */}
              <View className="mb-lg">
                <Text preset="subheading" className="mb-md">
                  {i18n.t('admin.tags.selectedCategories')}
                </Text>

                {selectedCategories.length === 0 ? (
                  <View className="p-lg bg-background-SECONDARY rounded-md items-center">
                    <Text className="text-text-secondary">
                      {i18n.t('admin.tags.noSelectedCategories')}
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row flex-wrap gap-sm">
                    {selectedCategories.map((category, index) => (
                      <View key={index} className="flex-row items-center bg-primary-light rounded-md py-xs px-sm mb-sm mr-sm">
                        <Text className="mr-xs">{category}</Text>
                        <TouchableOpacity onPress={() => removeCategory(category)}>
                          <Ionicons name="close-circle" size={20} color="#333333" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Search Categories */}
              <View className="mb-lg">
                <TextInput
                  placeholder={i18n.t('admin.tags.searchCategories')}
                  value={categorySearch}
                  onChangeText={setCategorySearch}
                  leftIcon={<Ionicons name="search" size={20} color={COLORS.grey.MEDIUM} />}
                />
              </View>

              {/* Available Categories */}
              <View className="mb-lg">
                <Text preset="subheading" className="mb-md">
                  {i18n.t('admin.tags.availableCategories')}
                </Text>

                {filteredCategories.length === 0 ? (
                  <View className="p-lg bg-background-SECONDARY rounded-md items-center">
                    <Text className="text-text-secondary">
                      {i18n.t('admin.tags.noCategoriesFound')}
                    </Text>
                  </View>
                ) : (
                  <View className="max-h-[200px]">
                    {filteredCategories.map((category, index) => {
                      const isSelected = selectedCategories.includes(category);
                      return (
                        <TouchableOpacity
                          key={index}
                          className={`flex-row items-center py-sm px-md border-b border-border-default ${isSelected ? 'bg-primary-light/30' : ''}`}
                          onPress={() => toggleCategory(category)}
                        >
                          <View className="mr-sm">
                            {isSelected ? (
                              <Ionicons name="checkbox" size={24} color={COLORS.primary.DARKEST} />
                            ) : (
                              <Ionicons name="square-outline" size={24} color={COLORS.grey.MEDIUM} />
                            )}
                          </View>
                          <Text className={`text-text-default ${isSelected ? 'font-bold' : ''}`}>
                            {category}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </FormSection>
          </ScrollView>

          <View className="flex-row justify-end p-lg border-t border-border-default">
            <Button
              label={i18n.t('common.cancel')}
              onPress={onClose}
              variant="outline"
              className="ml-md min-w-[100px]"
            />
            <Button
              label={i18n.t('common.save')}
              onPress={handleSave}
              className="ml-md min-w-[100px]"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
