import React, { useState, useEffect } from 'react';
import { View, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/form/TextInput';
import { FormGroup } from '@/components/form/FormGroup';
import { AdminRecipeTag, AdminRecipeTagTranslation, pickTranslation } from '@/types/recipe.admin.types';
import { COLORS } from '@/constants/design-tokens';
import { CANONICAL_TAG_CATEGORIES, adminRecipeTagService } from '@/services/admin/adminRecipeTagService';
import { Ionicons } from '@expo/vector-icons';
import { AutoTranslateButton } from '@/components/admin/shared';
import i18n from '@/i18n';
import { useActiveLocales } from '@/hooks/admin/useActiveLocales';
import { translateContent } from '@/services/admin/adminTranslateService';
import logger from '@/services/logger';
import { formatCategoryForDisplay } from '@/utils/formatters';

interface TagEditModalProps {
  visible: boolean;
  tag?: AdminRecipeTag | null;
  isNew: boolean;
  categories?: string[];
  onClose: () => void;
  onSave: (tag: AdminRecipeTag, isNew: boolean) => void;
}

export function TagEditModal({ visible, tag, isNew, categories, onClose, onSave }: TagEditModalProps) {
  const { locales } = useActiveLocales();
  const [translations, setTranslations] = useState<AdminRecipeTagTranslation[]>([]);
  const [slug, setSlug] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (visible) {
      if (isNew) {
        // Initialize with empty translations for each locale
        setTranslations(locales.map(l => ({ locale: l.code, name: '' })));
        setSlug('');
        setSelectedCategories([]);
      } else if (tag) {
        setTranslations(tag.translations || []);
        setSlug(tag.slug || '');
        setSelectedCategories(tag.categories || []);
      }
      fetchCategories();
    }
  }, [visible, tag, isNew, locales, categories]);

  useEffect(() => {
    if (categorySearch.trim() === '') {
      setFilteredCategories(availableCategories);
    } else {
      const query = categorySearch.toLowerCase();
      setFilteredCategories(
        availableCategories.filter(category =>
          category.toLowerCase().includes(query) ||
          formatCategoryForDisplay(category).toLowerCase().includes(query)
        )
      );
    }
  }, [categorySearch, availableCategories]);

  const fetchCategories = () => {
    const nextCategories = categories?.length
      ? categories
      : [...CANONICAL_TAG_CATEGORIES];
    setAvailableCategories(nextCategories);
    setFilteredCategories(nextCategories);
  };

  const getTranslationName = (locale: string): string => {
    return pickTranslation(translations, locale)?.name || '';
  };

  const setTranslationName = (locale: string, name: string) => {
    const existing = translations.find(t => t.locale === locale);
    if (existing) {
      setTranslations(translations.map(t =>
        t.locale === locale ? { ...t, name } : t
      ));
    } else {
      setTranslations([...translations, { locale, name }]);
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
    const newErrors: Record<string, string> = {};

    // Check that at least one locale has a name
    const hasAnyName = translations.some(t => t.name?.trim());
    if (!hasAnyName) {
      locales.forEach(l => {
        newErrors[`name_${l.code}`] = i18n.t('validation.required');
      });
    }

    if (!slug.trim()) {
      newErrors.slug = i18n.t('validation.required');
    } else if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(slug.trim())) {
      newErrors.slug = i18n.t('admin.tags.errors.slugInvalid');
    }

    if (selectedCategories.length === 0) {
      newErrors.categories = i18n.t('validation.required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAutoTranslate = async () => {
    const sourceTranslation = translations.find(t => t.name?.trim());
    if (!sourceTranslation) return;

    const sourceLocale = sourceTranslation.locale;
    const targetLocales = locales
      .map(l => l.code)
      .filter(code => code !== sourceLocale);

    if (targetLocales.length === 0) return;

    setTranslating(true);
    try {
      const results = await translateContent(
        { name: sourceTranslation.name },
        sourceLocale,
        targetLocales,
      );

      let updated = [...translations];
      for (const result of results) {
        const existing = updated.find(t => t.locale === result.targetLocale);
        if (existing) {
          updated = updated.map(t =>
            t.locale === result.targetLocale
              ? { ...t, name: result.fields.name || t.name }
              : t
          );
        } else {
          updated.push({ locale: result.targetLocale, name: result.fields.name || '' });
        }
      }
      setTranslations(updated);
    } catch (error) {
      logger.error('Auto-translate failed:', error);
    } finally {
      setTranslating(false);
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const tagData: Omit<AdminRecipeTag, 'id'> = {
      slug: slug.trim(),
      translations: translations.filter(t => t.name?.trim()),
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
      logger.error('Error saving tag:', error);
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
            {/* Names Section - Dynamic locales */}
            <View className="mt-lg mb-xl">
              <Text preset="bodySmall" className="text-text-secondary font-medium mb-sm">{i18n.t('admin.tags.basicInfo')}</Text>
              <FormGroup
                label={i18n.t('admin.tags.slug')}
                error={errors.slug}
                className="mb-md"
              >
                <TextInput
                  value={slug}
                  onChangeText={setSlug}
                  autoCapitalize="none"
                />
              </FormGroup>
              {locales.map(locale => (
                <FormGroup
                  key={locale.code}
                  label={locale.displayName}
                  error={errors[`name_${locale.code}`]}
                  className="mb-md"
                >
                  <TextInput
                    value={getTranslationName(locale.code)}
                    onChangeText={(text) => setTranslationName(locale.code, text)}
                  />
                </FormGroup>
              ))}
              <AutoTranslateButton onPress={handleAutoTranslate} loading={translating} />
            </View>

            {/* Categories Section */}
            <View className="mt-lg mb-xl">
              <Text preset="bodySmall" className="text-text-secondary font-medium mb-sm">{i18n.t('admin.tags.categories')}</Text>
              {errors.categories ? (
                <Text preset="caption" className="text-status-error mb-sm">{errors.categories}</Text>
              ) : null}
              {/* Selected Categories */}
              <View className="mb-lg">
                <Text preset="subheading" className="mb-md">
                  {i18n.t('admin.tags.selectedCategories')}
                </Text>

                {selectedCategories.length === 0 ? (
                  <View className="p-lg bg-background-secondary rounded-md items-center">
                    <Text className="text-text-secondary">
                      {i18n.t('admin.tags.noSelectedCategories')}
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row flex-wrap gap-sm">
                    {selectedCategories.map((category, index) => (
                      <View key={index} className="flex-row items-center bg-primary-light rounded-md py-xs px-sm mb-sm mr-sm">
                        <Text className="mr-xs">{formatCategoryForDisplay(category)}</Text>
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
                  leftIcon={<Ionicons name="search" size={20} color={COLORS.grey.medium} />}
                />
              </View>

              {/* Available Categories */}
              <View className="mb-lg">
                <Text preset="subheading" className="mb-md">
                  {i18n.t('admin.tags.availableCategories')}
                </Text>

                {filteredCategories.length === 0 ? (
                  <View className="p-lg bg-background-secondary rounded-md items-center">
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
                              <Ionicons name="checkbox" size={24} color={COLORS.primary.darkest} />
                            ) : (
                              <Ionicons name="square-outline" size={24} color={COLORS.grey.medium} />
                            )}
                          </View>
                          <Text className={`text-text-default ${isSelected ? 'font-bold' : ''}`}>
                            {formatCategoryForDisplay(category)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
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
