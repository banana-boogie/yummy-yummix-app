import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { AdminIngredient, AdminIngredientTranslation, pickTranslation , NutritionalFacts } from '@/types/recipe.admin.types';
import { ImageUploadSection } from '@/components/admin/recipes/forms/common/ImageUploadSection';
import { TranslationsSection } from '@/components/admin/ingredients/IngredientForm/TranslationsSection';
import { NutritionalFactsSection } from '@/components/admin/ingredients/IngredientForm/NutritionalFactsSection';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { AlertModal } from '@/components/common/AlertModal';
import i18n from '@/i18n';
import logger from '@/services/logger';

const scrollContentStyle = { padding: 24, gap: 32 } as const;

interface IngredientFormProps {
    ingredient?: AdminIngredient;
    onSave: (data: AdminIngredient) => Promise<void>;
    onCancel: () => void;
    saving: boolean;
}

interface ValidationErrors {
    [key: string]: string | { [key: string]: string } | undefined;
    pictureUrl?: string;
    nutritionalFacts?: {
        [key: string]: string;
    };
}

export function IngredientForm({
    ingredient,
    onSave,
    onCancel,
    saving,
}: IngredientFormProps) {
    const [showSuccessAlert, setShowSuccessAlert] = useState(false);
    const [showErrorAlert, setShowErrorAlert] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [formData, setFormData] = useState<AdminIngredient>({
        id: ingredient?.id || '',
        translations: ingredient?.translations || [
            { locale: 'es', name: '', pluralName: '' },
            { locale: 'en', name: '', pluralName: '' },
        ],
        pictureUrl: ingredient?.pictureUrl || '',
        nutritionalFacts: ingredient?.nutritionalFacts || {
            calories: '',
            protein: '',
            fat: '',
            carbohydrates: ''
        }
    });

    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

    const validateForm = (data: Partial<AdminIngredient>): ValidationErrors => {
        const errors: ValidationErrors = {};

        // Validate that at least es and en have names
        const translations = data.translations || [];
        const esT = pickTranslation(translations, 'es');
        const enT = pickTranslation(translations, 'en');

        if (!enT?.name) errors['name_en'] = i18n.t('validation.required');
        if (!esT?.name) errors['name_es'] = i18n.t('validation.required');
        if (!enT?.pluralName) errors['pluralName_en'] = i18n.t('validation.required');
        if (!esT?.pluralName) errors['pluralName_es'] = i18n.t('validation.required');

        // PICTURE VALIDATION
        if (!data.pictureUrl) {
            errors.pictureUrl = i18n.t('validation.required');
        }

        // NUTRITIONAL FACTS VALIDATION
        const nutritionalFields = ['calories', 'protein', 'fat', 'carbohydrates'] as const;
        const maxValues = { calories: 1000, protein: 100, fat: 100, carbohydrates: 100 };

        let hasNutritionalErrors = false;
        const nutritionalErrors: { [key: string]: string } = {};

        for (const field of nutritionalFields) {
            const value = data.nutritionalFacts?.[field];
            if (value === undefined || value === '') {
                nutritionalErrors[field] = i18n.t('validation.required');
                hasNutritionalErrors = true;
                continue;
            }

            const numericValue = typeof value === 'string' ? parseFloat(value) : value;

            if (isNaN(numericValue) || numericValue < 0) {
                nutritionalErrors[field] = i18n.t('validation.minValue', { min: 0 });
                hasNutritionalErrors = true;
                continue;
            }

            if (numericValue > maxValues[field]) {
                nutritionalErrors[field] = i18n.t('validation.maxValue', { max: maxValues[field] });
                hasNutritionalErrors = true;
            }
        }

        if (hasNutritionalErrors) {
            errors.nutritionalFacts = nutritionalErrors;
        }

        setValidationErrors(errors);
        return errors;
    };


    const handleSubmit = async () => {
        try {
            const errors = validateForm(formData);
            if (Object.keys(errors).length > 0) {
                setErrorMessage(i18n.t('admin.ingredients.errors.validationFailed'));
                setShowErrorAlert(true);
                return;
            }

            await onSave(formData);
            setShowSuccessAlert(true);
        } catch (error) {
            logger.error('Error saving ingredient:', error);
            setErrorMessage(i18n.t('admin.ingredients.errors.saveFailed', { defaultValue: 'Failed to save ingredient. Please try again.' }));
            setShowErrorAlert(true);
        }
    };

    const handleSuccessConfirm = () => {
        setShowSuccessAlert(false);
        onCancel(); // Close the modal
    };

    // Get a display name for the nutritional facts lookup — prefer English (best training data)
    const ingredientDisplayName =
        pickTranslation(formData.translations, 'en')?.name?.trim() ||
        pickTranslation(formData.translations, 'es')?.name?.trim() ||
        '';

    return (
        <View className="flex-1">
            <AlertModal
                visible={showSuccessAlert}
                title={i18n.t('admin.ingredients.success.title')}
                message={ingredient
                    ? i18n.t('admin.ingredients.success.updateSuccessMessage')
                    : i18n.t('admin.ingredients.success.createSuccessMessage')
                }
                confirmText={i18n.t('common.ok')}
                onConfirm={handleSuccessConfirm}
            />

            <AlertModal
                visible={showErrorAlert}
                title={i18n.t('admin.ingredients.errors.title')}
                message={errorMessage}
                onConfirm={() => setShowErrorAlert(false)}
                confirmText={i18n.t('common.ok')}
            />

            <View className="flex-row justify-between items-center px-md mb-md border-b border-border-DEFAULT pb-xs">
                <Text preset="h1" className="font-bold mb-0">
                    {ingredient ? i18n.t('admin.ingredients.editTitle') : i18n.t('admin.ingredients.createTitle')}
                </Text>
                <TouchableOpacity
                    className="p-xs rounded-full"
                    onPress={onCancel}
                    disabled={saving}
                >
                    <Ionicons name="close" size={24} color={COLORS.grey.MEDIUM} />
                </TouchableOpacity>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={scrollContentStyle}
                showsVerticalScrollIndicator={false}
            >

                <ImageUploadSection
                    title={i18n.t('admin.ingredients.image')}
                    imageUrl={formData.pictureUrl}
                    onImageSelected={(file) => setFormData({ ...formData, pictureUrl: file })}
                    error={validationErrors.pictureUrl as string}
                    required={true}
                />

                <TranslationsSection
                    translations={formData.translations}
                    errors={validationErrors as Record<string, string>}
                    onChange={(translations) => setFormData({ ...formData, translations })}
                    required={true}
                />

                <NutritionalFactsSection
                    nutritionalFacts={formData.nutritionalFacts}
                    onChange={(facts: NutritionalFacts) => setFormData({ ...formData, nutritionalFacts: facts })}
                    errors={validationErrors.nutritionalFacts as { [key: string]: string }}
                    required={true}
                    ingredientName={ingredientDisplayName}
                />

                <View className="flex-row justify-end gap-md mt-md">
                    <Button
                        onPress={onCancel}
                        label={i18n.t('common.cancel')}
                        variant="outline"
                        disabled={saving}
                    />
                    <Button
                        onPress={handleSubmit}
                        label={i18n.t('common.save')}
                        loading={saving}
                        disabled={saving}
                    />
                </View>
            </ScrollView>
        </View>
    );
}
