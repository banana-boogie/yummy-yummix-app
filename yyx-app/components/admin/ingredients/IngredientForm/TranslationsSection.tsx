import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { FormGroup } from '@/components/form/FormGroup';
import { TextInput } from '@/components/form/TextInput';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import i18n from '@/i18n';
import { FormSection } from '@/components/form/FormSection';
import { FormRow } from '@/components/form/FormRow';
import { AdminIngredientTranslation } from '@/types/recipe.admin.types';
import { useAdminLocales } from '@/hooks/admin/useAdminLocales';
import { translateContent } from '@/services/admin/adminTranslateService';

interface TranslationsSectionProps {
  translations: AdminIngredientTranslation[];
  errors?: Record<string, string>;
  onChange: (translations: AdminIngredientTranslation[]) => void;
  required?: boolean;
}

export function TranslationsSection({
  translations,
  errors = {},
  onChange,
  required = false
}: TranslationsSectionProps) {
  const { locales, loading: localesLoading } = useAdminLocales();
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  const getTranslation = (locale: string, field: string): string => {
    const t = translations.find(tr => tr.locale === locale);
    return (t as any)?.[field] || '';
  };

  const setTranslation = (locale: string, field: string, value: string) => {
    const existing = translations.find(t => t.locale === locale);
    if (existing) {
      onChange(translations.map(t =>
        t.locale === locale ? { ...t, [field]: value } : t
      ));
    } else {
      onChange([...translations, { locale, name: '', [field]: value } as AdminIngredientTranslation]);
    }
  };

  const handleAutoTranslate = async () => {
    // Find the first locale with filled content (typically 'es')
    const sourceTranslation = translations.find(t => t.name?.trim());
    if (!sourceTranslation) return;

    const sourceLocale = sourceTranslation.locale;
    const targetLocales = locales
      .map(l => l.code)
      .filter(code => code !== sourceLocale);

    if (targetLocales.length === 0) return;

    const fields: Record<string, string> = {};
    if (sourceTranslation.name) fields.name = sourceTranslation.name;
    if (sourceTranslation.pluralName) fields.pluralName = sourceTranslation.pluralName;

    setTranslating(true);
    setTranslateError(null);
    try {
      const results = await translateContent(fields, sourceLocale, targetLocales);
      let updated = [...translations];
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
              ? { ...t, name: result.fields.name || t.name, pluralName: result.fields.pluralName || t.pluralName }
              : t
          );
        } else {
          updated.push({
            locale: result.targetLocale,
            name: result.fields.name || '',
            pluralName: result.fields.pluralName,
          });
        }
      }
      onChange(updated);
      if (failedLocales.length > 0) {
        setTranslateError(
          i18n.t('admin.translate.partialFailure', {
            locales: failedLocales.join(', '),
            defaultValue: `Translation failed for: ${failedLocales.join(', ')}`,
          })
        );
      }
    } catch (error) {
      console.error('Auto-translate failed:', error);
      setTranslateError(i18n.t('admin.translate.autoTranslateFailed', { defaultValue: 'Auto-translate failed. Please try again.' }));
    } finally {
      setTranslating(false);
    }
  };

  if (localesLoading) {
    return (
      <FormSection title={i18n.t('admin.ingredients.translations')}>
        <ActivityIndicator />
      </FormSection>
    );
  }

  return (
    <FormSection title={i18n.t('admin.ingredients.translations')}>
      {locales.map(locale => (
        <View key={locale.code} className="mb-lg">
          <Text preset="subheading" className="mb-sm">{locale.displayName}</Text>
          <FormRow>
            <FormGroup
              label={i18n.t('admin.ingredients.name', { defaultValue: 'Name' })}
              error={errors[`name_${locale.code}`]}
              required={required}
              className="flex-1"
            >
              <TextInput
                value={getTranslation(locale.code, 'name')}
                onChangeText={(text) => setTranslation(locale.code, 'name', text)}
                placeholder={locale.code.startsWith('es') ? 'ej., plátano' : 'e.g., banana'}
              />
            </FormGroup>

            <FormGroup
              label={i18n.t('admin.ingredients.pluralName', { defaultValue: 'Plural Name' })}
              error={errors[`pluralName_${locale.code}`]}
              required={required}
              className="flex-1"
            >
              <TextInput
                value={getTranslation(locale.code, 'pluralName')}
                onChangeText={(text) => setTranslation(locale.code, 'pluralName', text)}
                placeholder={locale.code.startsWith('es') ? 'ej., plátanos' : 'e.g., bananas'}
              />
            </FormGroup>
          </FormRow>
        </View>
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
  );
}
