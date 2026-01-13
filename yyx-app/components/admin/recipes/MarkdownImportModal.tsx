import React, { useState } from 'react';
import { Modal, View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/form/TextInput';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
import { CreateEditIngredientModal } from '@/components/admin/ingredients/CreateEditIngredientModal';
import { TagEditModal } from '@/components/admin/tags/TagEditModal';
import { AdminIngredient, AdminRecipeTag } from '@/types/recipe.admin.types';

interface MarkdownImportModalProps {
  visible: boolean;
  markdownText: string;
  onChangeText: (text: string) => void;
  onClose: () => void;
  onImport: () => Promise<void>;
  loading: boolean;
  error?: string;
  missingIngredients?: string[];
  missingTags?: string[];
  onIngredientCreated: (ingredient: AdminIngredient) => void;
  onTagCreated: (tag: AdminRecipeTag) => void;
}

export function MarkdownImportModal({
  visible,
  markdownText,
  onChangeText,
  onClose,
  onImport,
  loading,
  error,
  missingIngredients = [],
  missingTags = [],
  onIngredientCreated,
  onTagCreated
}: MarkdownImportModalProps) {
  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);

  const handleCreateIngredient = (ingredient: string) => {
    setSelectedIngredient(ingredient);
    setShowIngredientModal(true);
  };

  const handleCreateTag = (tag: string) => {
    setSelectedTag(tag);
    setShowTagModal(true);
  };

  const handleIngredientSaved = (savedIngredient: AdminIngredient) => {
    setShowIngredientModal(false);
    onIngredientCreated(savedIngredient);
  };

  const handleTagSaved = (savedTag: AdminRecipeTag) => {
    setShowTagModal(false);
    onTagCreated(savedTag);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-center items-center bg-black/50 p-md"
      >
        <View className="bg-background-DEFAULT rounded-md w-full max-w-[800px] max-h-[90%] shadow-md">
          <View className="p-lg border-b border-border-DEFAULT">
            <Text preset="h1">{i18n.t('admin.recipes.form.initialSetup.populateRecipe')}</Text>
          </View>

          <ScrollView className="p-lg max-h-[500px]">
            <TextInput
              multiline
              numberOfLines={20}
              value={markdownText}
              onChangeText={onChangeText}
              placeholder={i18n.t('admin.recipes.form.initialSetup.pasteHere')}
              className="w-full h-[200px] p-sm border border-border-DEFAULT rounded-sm"
              style={{ textAlignVertical: 'top' }}
            />

            {error && (
              <View className="mt-md p-sm bg-status-ERROR rounded-sm">
                <Text className="color-white font-bold">{error}</Text>
              </View>
            )}

            {(missingIngredients.length > 0 || missingTags.length > 0) && (
              <View className="mt-md p-sm bg-status-ERROR rounded-sm">
                {missingIngredients.length > 0 && (
                  <View className="mb-md">
                    <Text className="font-bold mb-sm text-white">{i18n.t('admin.recipes.form.initialSetup.missingIngredients')}</Text>
                    {missingIngredients.map((ingredient, index) => (
                      <View key={index} className="flex-row justify-between items-center mb-xs">
                        <Text className="flex-1 text-white">• {ingredient}</Text>
                        <Button
                          label={i18n.t('common.create')}
                          variant="outline"
                          size="small"
                          onPress={() => handleCreateIngredient(ingredient)}
                          className="ml-sm bg-white border-white"
                          textClassName="text-status-ERROR"
                        />
                      </View>
                    ))}
                  </View>
                )}

                {missingTags.length > 0 && (
                  <View className="mb-md">
                    <Text className="font-bold mb-sm text-white">{i18n.t('admin.recipes.form.initialSetup.missingTags')}</Text>
                    {missingTags.map((tag, index) => (
                      <View key={index} className="flex-row justify-between items-center mb-xs">
                        <Text className="flex-1 text-white">• {tag}</Text>
                        <Button
                          label={i18n.t('common.create')}
                          variant="outline"
                          size="small"
                          onPress={() => handleCreateTag(tag)}
                          className="ml-sm bg-white border-white"
                          textClassName="text-status-ERROR"
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <View className="flex-row justify-end p-lg border-t border-border-DEFAULT">
            <Button
              label={i18n.t('common.cancel')}
              onPress={onClose}
              variant="outline"
              className="ml-md min-w-[100px]"
            />
            <Button
              label={i18n.t('common.import')}
              onPress={onImport}
              loading={loading}
              className="ml-md min-w-[100px]"
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Create Ingredient Modal */}
      <CreateEditIngredientModal
        visible={showIngredientModal}
        onClose={() => setShowIngredientModal(false)}
        onSuccess={handleIngredientSaved}
      />

      {/* Create Tag Modal */}
      <TagEditModal
        visible={showTagModal}
        onClose={() => setShowTagModal(false)}
        onSave={handleTagSaved}
        isNew={true}
      />
    </Modal>
  );
}
