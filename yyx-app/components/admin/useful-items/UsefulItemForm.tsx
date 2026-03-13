import React, { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/common/Text';
import { TextInput } from '@/components/form/TextInput';
import { Button } from '@/components/common/Button';
import { AdminUsefulItem, AdminUsefulItemTranslation, pickTranslation } from '@/types/recipe.admin.types';
import i18n from '@/i18n';
import { FormSection } from '@/components/form/FormSection';
import { FormGroup } from '@/components/form/FormGroup';
import { FormRow } from '@/components/form/FormRow';
import { ImageUploadSection } from '@/components/admin/recipes/forms/common/ImageUploadSection';
import { useActiveLocales } from '@/hooks/admin/useActiveLocales';
import { translateContent } from '@/services/admin/adminTranslateService';

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
    const { locales: rawLocales } = useActiveLocales(true);
    // Filter es-MX: base 'es' is already Mexican Spanish, so es-MX is redundant in admin forms.
    const locales = rawLocales.filter(l => l.code !== 'es-MX');
    const [translating, setTranslating] = useState(false);
    const [translateError, setTranslateError] = useState<string | null>(null);

    const [formData, setFormData] = useState<AdminUsefulItem>({
        id: usefulItem?.id || '',
        translations: usefulItem?.translations || [
            { locale: 'es', name: '' },
            { locale: 'en', name: '' },
        ],
        pictureUrl: usefulItem?.pictureUrl || '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const getTranslationName = (locale: string): string => {
        return pickTranslation(formData.translations, locale)?.name || '';
    };

    const setTranslationName = (locale: string, name: string) => {
        const existing = formData.translations.find(t => t.locale === locale);
        if (existing) {
            setFormData({
                ...formData,
                translations: formData.translations.map(t =>
                    t.locale === locale ? { ...t, name } : t
                ),
            });
        } else {
            setFormData({
                ...formData,
                translations: [...formData.translations, { locale, name }],
            });
        }
    };

    const handleAutoTranslate = async () => {
        const sourceTranslation = formData.translations.find(t => t.name?.trim());
        if (!sourceTranslation) return;

        const sourceLocale = sourceTranslation.locale;
        const targetLocales = locales
            .map(l => l.code)
            .filter(code => code !== sourceLocale);

        if (targetLocales.length === 0) return;

        setTranslating(true);
        setTranslateError(null);
        try {
            const results = await translateContent(
                { name: sourceTranslation.name },
                sourceLocale,
                targetLocales,
            );

            let updated = [...formData.translations];
            for (const result of results) {
                if (result.error) continue;
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
            setFormData({ ...formData, translations: updated });
        } catch (error) {
            console.error('Auto-translate failed:', error);
            setTranslateError(i18n.t('admin.translate.autoTranslateFailed', { defaultValue: 'Auto-translate failed. Please try again.' }));
        } finally {
            setTranslating(false);
        }
    };

    const handleSubmit = async () => {
        // Reset errors
        const newErrors: Record<string, string> = {};

        // Validate: require at least es and en
        const esName = getTranslationName('es');
        const enName = getTranslationName('en');
        if (!enName.trim()) {
            newErrors['name_en'] = i18n.t('admin.usefulItems.form.errors.nameEnRequired');
        }
        if (!esName.trim()) {
            newErrors['name_es'] = i18n.t('admin.usefulItems.form.errors.nameEsRequired');
        }
        if (!formData.pictureUrl) {
            newErrors['pictureUrl'] = i18n.t('admin.usefulItems.form.errors.imageRequired');
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        const data: AdminUsefulItem = {
            id: usefulItem?.id || '',
            translations: formData.translations.filter(t => t.name?.trim()),
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
                error={errors['pictureUrl']}
                required={true}
            />

            <FormSection title={i18n.t('admin.usefulItems.form.detailsTitle')} titleStyle={{ marginBottom: 8 }}>
                {locales.map(locale => (
                    <FormGroup
                        key={locale.code}
                        error={errors[`name_${locale.code}`]}
                        className="mb-lg"
                    >
                        <TextInput
                            value={getTranslationName(locale.code)}
                            onChangeText={(text) => setTranslationName(locale.code, text)}
                            placeholder={locale.code.startsWith('es')
                                ? i18n.t('admin.usefulItems.form.nameEsPlaceholder')
                                : i18n.t('admin.usefulItems.form.nameEnPlaceholder')}
                            label={locale.displayName}
                        />
                    </FormGroup>
                ))}
                <Button
                    onPress={handleAutoTranslate}
                    loading={translating}
                    disabled={translating}
                    variant="outline"
                    size="small"
                >
                    {translating
                        ? i18n.t('admin.translate.translating')
                        : i18n.t('admin.translate.autoTranslate')
                    }
                </Button>
                {translateError ? (
                    <Text preset="bodySmall" className="text-status-error mt-sm">{translateError}</Text>
                ) : null}
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
