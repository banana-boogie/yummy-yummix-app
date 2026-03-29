import React, { useState } from 'react';
import { View, Platform, Pressable } from 'react-native';

import { Text } from '@/components/common/Text';
import { TextInput } from '@/components/form/TextInput';
import { Button } from '@/components/common/Button';
import { AdminKitchenTool, pickTranslation } from '@/types/recipe.admin.types';
import i18n from '@/i18n';
import { FormGroup } from '@/components/form/FormGroup';
import { ImageUploadSection } from '@/components/admin/recipes/forms/common/ImageUploadSection';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { useAdminLocales } from '@/hooks/admin/useAdminLocales';
import { translateContent } from '@/services/admin/adminTranslateService';
import logger from '@/services/logger';

interface KitchenToolFormProps {
    kitchenTool?: AdminKitchenTool;
    onSave: (data: AdminKitchenTool) => Promise<void>;
    onCancel: () => void;
    onDelete?: () => void;
    saving: boolean;
}

export function KitchenToolForm({
    kitchenTool,
    onSave,
    onCancel,
    onDelete,
    saving,
}: KitchenToolFormProps) {
    const { locales } = useAdminLocales();
    const [translating, setTranslating] = useState(false);
    const [translateError, setTranslateError] = useState<string | null>(null);

    const [formData, setFormData] = useState<AdminKitchenTool>({
        id: kitchenTool?.id || '',
        translations: kitchenTool?.translations || [
            { locale: 'es', name: '' },
            { locale: 'en', name: '' },
        ],
        pictureUrl: kitchenTool?.pictureUrl || '',
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
            const failedLocales: string[] = [];
            for (const result of results) {
                if (result.error) {
                    failedLocales.push(result.targetLocale);
                    continue;
                }
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
            if (failedLocales.length > 0) {
                setTranslateError(
                    i18n.t('admin.translate.partialFailure', {
                        locales: failedLocales.join(', '),
                        defaultValue: `Translation failed for: ${failedLocales.join(', ')}`,
                    })
                );
            }
        } catch (error) {
            logger.error('Auto-translate failed:', error);
            setTranslateError(i18n.t('admin.translate.autoTranslateFailed', { defaultValue: 'Auto-translate failed. Please try again.' }));
        } finally {
            setTranslating(false);
        }
    };

    const handleSubmit = async () => {
        const newErrors: Record<string, string> = {};

        const esName = getTranslationName('es');
        const enName = getTranslationName('en');
        if (!enName.trim()) {
            newErrors['name_en'] = i18n.t('admin.kitchenTools.form.errors.nameEnRequired');
        }
        if (!esName.trim()) {
            newErrors['name_es'] = i18n.t('admin.kitchenTools.form.errors.nameEsRequired');
        }
        if (!formData.pictureUrl) {
            newErrors['pictureUrl'] = i18n.t('admin.kitchenTools.form.errors.imageRequired');
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        const data: AdminKitchenTool = {
            id: kitchenTool?.id || '',
            translations: formData.translations.filter(t => t.name?.trim()),
            pictureUrl: formData.pictureUrl,
        };

        await onSave(data);
    };

    return (
        <View className="flex-1 justify-between">
            {/* Form content */}
            <View>
                {/* Image — compact, left-aligned */}
                <View className="flex-row items-start mb-md">
                    <ImageUploadSection
                        imageUrl={formData.pictureUrl}
                        onImageSelected={(fileObject) => setFormData({ ...formData, pictureUrl: fileObject })}
                        error={errors['pictureUrl']}
                        required={true}
                    />
                </View>

                {/* Translations */}
                <View className="flex-row items-center justify-between mb-sm">
                    <Text preset="body" className="text-text-default font-semibold">Translations</Text>
                    <Pressable
                        onPress={handleAutoTranslate}
                        disabled={translating}
                        className="flex-row items-center gap-xxs px-md py-xs rounded-full border border-border-default"
                        style={({ pressed }: any) => [
                            { opacity: pressed || translating ? 0.5 : 1 },
                            Platform.OS === 'web' ? { cursor: 'pointer' } as any : {},
                        ]}
                    >
                        <Ionicons name="language-outline" size={14} color={COLORS.primary.medium} />
                        <Text preset="caption" className="text-text-default">
                            {translating
                                ? i18n.t('admin.translate.translating')
                                : i18n.t('admin.translate.autoTranslate')
                            }
                        </Text>
                    </Pressable>
                </View>
                {translateError ? (
                    <Text preset="caption" className="text-status-error mb-sm">{translateError}</Text>
                ) : null}

                {locales.map(locale => (
                    <FormGroup
                        key={locale.code}
                        error={errors[`name_${locale.code}`]}
                        className="mb-sm"
                    >
                        <TextInput
                            value={getTranslationName(locale.code)}
                            onChangeText={(text) => setTranslationName(locale.code, text)}
                            placeholder={locale.code.startsWith('es')
                                ? i18n.t('admin.kitchenTools.form.nameEsPlaceholder')
                                : i18n.t('admin.kitchenTools.form.nameEnPlaceholder')}
                            label={locale.displayName}
                        />
                    </FormGroup>
                ))}

            </View>

            {/* Footer: Delete left, Cancel + Save right */}
            <View className="flex-row items-center justify-between pt-lg mt-lg border-t border-border-default pb-sm">
                {onDelete ? (
                    <Pressable
                        onPress={onDelete}
                        disabled={saving}
                        style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}}
                    >
                        <Text preset="bodySmall" className="text-status-error">
                            {i18n.t('common.delete')}
                        </Text>
                    </Pressable>
                ) : <View />}
                <View className="flex-row gap-sm">
                    <Button
                        onPress={onCancel}
                        disabled={saving}
                        variant="secondary"
                        size="small"
                    >
                        {i18n.t('common.cancel')}
                    </Button>
                    <Button
                        onPress={handleSubmit}
                        disabled={saving}
                        loading={saving}
                        size="small"
                    >
                        {i18n.t('common.save')}
                    </Button>
                </View>
            </View>
        </View>
    );
}
