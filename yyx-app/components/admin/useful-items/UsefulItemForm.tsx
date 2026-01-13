import React, { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/common/Text';
import { TextInput } from '@/components/form/TextInput';
import { Button } from '@/components/common/Button';
import { AdminUsefulItem } from '@/types/recipe.admin.types';
import i18n from '@/i18n';
import { FormSection } from '@/components/form/FormSection';
import { FormGroup } from '@/components/form/FormGroup';
import { FormRow } from '@/components/form/FormRow';
import { ImageUploadSection } from '@/components/admin/recipes/forms/common/ImageUploadSection';

interface UsefulItemFormProps {
    usefulItem?: AdminUsefulItem;
    onSave: (data: AdminUsefulItem) => Promise<void>;
    onCancel: () => void;
    saving: boolean;
}

export function UsefulItemForm({
    usefulItem,
    onSave,
    onCancel,
    saving,
}: UsefulItemFormProps) {
    const [formData, setFormData] = useState<AdminUsefulItem>({
        id: usefulItem?.id || '',
        nameEn: usefulItem?.nameEn || '',
        nameEs: usefulItem?.nameEs || '',
        pictureUrl: usefulItem?.pictureUrl || '',
    });

    const [nameEnError, setNameEnError] = useState('');
    const [nameEsError, setNameEsError] = useState('');
    const [pictureUrlError, setPictureUrlError] = useState('');

    const handleSubmit = async () => {
        // Reset errors
        setNameEnError('');
        setNameEsError('');
        setPictureUrlError('');

        // Validate
        let hasError = false;
        if (!formData.nameEn.trim()) {
            setNameEnError(i18n.t('admin.usefulItems.form.errors.nameEnRequired'));
            hasError = true;
        }
        if (!formData.nameEs.trim()) {
            setNameEsError(i18n.t('admin.usefulItems.form.errors.nameEsRequired'));
            hasError = true;
        }
        if (!formData.pictureUrl) {
            setPictureUrlError(i18n.t('admin.usefulItems.form.errors.imageRequired'));
            hasError = true;
        }

        if (hasError) return;

        const data: AdminUsefulItem = {
            id: usefulItem?.id || '',
            nameEn: formData.nameEn.trim(),
            nameEs: formData.nameEs.trim(),
            pictureUrl: formData.pictureUrl,
        };

        await onSave(data);
    };

    return (
        <View className="flex-1">
            <Text preset="h1" className="mb-lg">
                {usefulItem ? i18n.t('admin.usefulItems.form.editTitle') : i18n.t('admin.usefulItems.form.createTitle')}
            </Text>

            <ImageUploadSection
                title={i18n.t('admin.usefulItems.form.imageTitle')}
                imageUrl={formData.pictureUrl}
                onImageSelected={(fileObject) => setFormData({ ...formData, pictureUrl: fileObject })}
                error={pictureUrlError}
                required={true}
            />

            <FormSection title={i18n.t('admin.usefulItems.form.detailsTitle')} titleStyle={{ marginBottom: 8 }}>
                <FormGroup
                    error={nameEnError}
                    className="mb-lg"
                >
                    <TextInput
                        value={formData.nameEn}
                        onChangeText={(text) => setFormData({ ...formData, nameEn: text })}
                        placeholder={i18n.t('admin.usefulItems.form.nameEnPlaceholder')}
                        label={i18n.t('admin.usefulItems.form.nameEn')}
                    />
                </FormGroup>

                <FormGroup
                    error={nameEsError}
                    className="mb-lg"
                >
                    <TextInput
                        value={formData.nameEs}
                        onChangeText={(text) => setFormData({ ...formData, nameEs: text })}
                        placeholder={i18n.t('admin.usefulItems.form.nameEsPlaceholder')}
                        label={i18n.t('admin.usefulItems.form.nameEs')}
                    />
                </FormGroup>
            </FormSection>

            <FormRow className="justify-end">
                <Button
                    onPress={onCancel}
                    disabled={saving}
                    variant="secondary"
                >
                    {i18n.t('common.cancel')}
                </Button>

                <Button
                    onPress={handleSubmit}
                    disabled={saving}
                    loading={saving}
                >
                    {i18n.t('common.save')}
                </Button>
            </FormRow>
        </View>
    );
}
