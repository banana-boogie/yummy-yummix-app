import React from 'react';
import { View } from 'react-native';
import { FormGroup } from '@/components/form/FormGroup';
import { TextInput } from '@/components/form/TextInput';
import i18n from '@/i18n';
import { FormSection } from '@/components/form/FormSection';
import { FormRow } from '@/components/form/FormRow';

interface TranslationFields {
  nameEn?: string;
  nameEs?: string;
  pluralNameEn?: string;
  pluralNameEs?: string;
}

interface TranslationErrors {
  nameEn?: string;
  nameEs?: string;
  pluralNameEn?: string;
  pluralNameEs?: string;
}

interface TranslationsSectionProps {
  translations: TranslationFields;
  errors?: TranslationErrors;
  onChange: (translations: TranslationFields) => void;
  required?: boolean;
}

export function TranslationsSection({
  translations,
  errors = {},
  onChange,
  required = false
}: TranslationsSectionProps) {
  const handleChange = (field: keyof TranslationFields, value: string) => {
    onChange({
      ...translations,
      [field]: value
    });
  };

  return (
    <FormSection title={i18n.t('admin.ingredients.translations')}>
      <FormRow className="mb-xl">
        <FormGroup
          label={i18n.t('admin.ingredients.nameEn')}
          error={errors.nameEn}
          required={required}
          className="flex-1"
        >
          <TextInput
            value={translations.nameEn}
            onChangeText={(text) => handleChange('nameEn', text)}
            placeholder={'e.g., banana'}
          />
        </FormGroup>

        <FormGroup
          label={i18n.t('admin.ingredients.pluralNameEn')}
          error={errors.pluralNameEn}
          required={required}
          className="flex-1"
        >
          <TextInput
            value={translations.pluralNameEn}
            onChangeText={(text) => handleChange('pluralNameEn', text)}
            placeholder={'e.g., bananas'}
          />
        </FormGroup>
      </FormRow>

      <FormRow>
        <FormGroup
          label={i18n.t('admin.ingredients.nameEs')}
          error={errors.nameEs}
          required={required}
          className="flex-1"
        >
          <TextInput
            value={translations.nameEs}
            onChangeText={(text) => handleChange('nameEs', text)}
            placeholder={'e.g., plátano'}
          />
        </FormGroup>

        <FormGroup
          label={i18n.t('admin.ingredients.pluralNameEs')}
          error={errors.pluralNameEs}
          required={required}
          className="flex-1"
        >
          <TextInput
            value={translations.pluralNameEs}
            onChangeText={(text) => handleChange('pluralNameEs', text)}
            placeholder={'e.g., plátanos'}
          />
        </FormGroup>
      </FormRow>
    </FormSection>
  );
}
