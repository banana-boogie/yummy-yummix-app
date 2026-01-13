import React, { useState } from 'react';
import { View } from 'react-native';
import { FormSection } from '@/components/form/FormSection';
import { FormGroup } from '@/components/form/FormGroup';
import { TextInput } from '@/components/form/TextInput';
import { Text } from '@/components/common/Text';
import i18n from '@/i18n';
import { NutritionalFacts } from '@/types/recipe.admin.types';
import { NutritionalFactsService } from '@/services/nutritionalFactsService';
import { Button } from '@/components/common/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { COLORS } from '@/constants/design-tokens';
import { useDevice } from '@/hooks/useDevice';

interface NutritionalFactsSectionProps {
  nutritionalFacts?: NutritionalFacts;
  onChange: (facts: NutritionalFacts) => void;
  errors?: NutritionalErrors;
  required?: boolean;
  error?: string;
  ingredientName?: string;
}

interface NutritionalErrors {
  calories?: string;
  protein?: string;
  fat?: string;
  carbohydrates?: string;
}

export function NutritionalFactsSection({
  nutritionalFacts = {
    per_100g: {
      calories: undefined,
      protein: undefined,
      fat: undefined,
      carbohydrates: undefined
    }
  },
  onChange,
  errors = {},
  ingredientName,
}: NutritionalFactsSectionProps) {
  const { isSmall } = useDevice();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof NutritionalFacts['per_100g'], value: string) => {
    // If value is empty or just a decimal point, treat specially
    let numericValue;

    if (value === '' || value === '.') {
      numericValue = '';  // Use empty string instead of undefined to keep it controlled
    } else if (value.endsWith('.') || value.endsWith('.0')) {
      // Keep the exact string for numbers ending with . or .0
      numericValue = value;
    } else {
      // Limit to one decimal place
      const parts = value.split('.');
      if (parts.length > 1 && parts[1].length > 1) {
        // If there's more than one decimal place, truncate to one
        value = `${parts[0]}.${parts[1].substring(0, 1)}`;
      }
      // Only convert to float if it's not a temporary decimal state
      numericValue = value;
    }

    const newFacts = {
      per_100g: {
        ...nutritionalFacts.per_100g,
        [field]: numericValue
      }
    };
    onChange(newFacts);
  };

  const formatValue = (value: number | string | undefined): string => {
    if (value === undefined || value === null) return '';
    return value.toString();
  };

  const fetchNutritionalFacts = async () => {
    setError(null);

    if (!ingredientName?.trim()) {
      setError(i18n.t('admin.ingredients.nutritionalFacts.errors.noIngredient'));
      return;
    }

    setIsLoading(true);
    try {
      const data = await NutritionalFactsService.fetchNutritionalFacts(ingredientName);
      onChange(data);
    } catch (error) {
      setError(i18n.t('admin.ingredients.nutritionalFacts.errors.fetchFailed'));
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormSection title={i18n.t('admin.ingredients.nutritionalFacts.title')} titleStyle={{ marginBottom: 4 }}>
      <Text preset="caption" color={COLORS.text.secondary} className="mb-xs">
        {i18n.t('admin.ingredients.nutritionalFacts.subtitle')}
      </Text>
      <Text preset="caption" color={COLORS.text.secondary} className="mb-sm">
        {i18n.t('admin.ingredients.nutritionalFacts.roundingRules')}
      </Text>

      <Button
        onPress={fetchNutritionalFacts}
        loading={isLoading}
        disabled={isLoading}
        variant="primary"
        size="small"
        className="mb-md self-start"
        label={i18n.t('admin.ingredients.nutritionalFacts.autoFillButton')}
      />

      {error && (
        <ErrorMessage message={error} />
      )}

      <View className={isSmall ? "flex-col gap-md" : "flex-row flex-wrap gap-md"}>
        <FormGroup
          label={`${i18n.t('admin.ingredients.nutritionalFacts.calories')} (${i18n.t('admin.ingredients.nutritionalFacts.unit.calories')})`}
          className={isSmall ? "w-full" : "flex-1 min-w-[45%]"}
          required={true}
        >
          <TextInput
            value={formatValue(nutritionalFacts?.per_100g?.calories)}
            onChangeText={(text) => handleChange('calories', text)}
            keyboardType="numeric"
            numericOnly
            allowDecimal={false}
            error={errors.calories}
          />
        </FormGroup>

        <FormGroup
          label={`${i18n.t('admin.ingredients.nutritionalFacts.protein')} (${i18n.t('admin.ingredients.nutritionalFacts.unit.grams')})`}
          className={isSmall ? "w-full" : "flex-1 min-w-[45%]"}
          required={true}
        >
          <TextInput
            value={formatValue(nutritionalFacts?.per_100g?.protein)}
            onChangeText={(text) => handleChange('protein', text)}
            keyboardType="numeric"
            numericOnly
            allowDecimal={true}
            error={errors.protein}
          />
        </FormGroup>

        <FormGroup
          label={`${i18n.t('admin.ingredients.nutritionalFacts.fat')} (${i18n.t('admin.ingredients.nutritionalFacts.unit.grams')})`}
          className={isSmall ? "w-full" : "flex-1 min-w-[45%]"}
          required={true}
        >
          <TextInput
            value={formatValue(nutritionalFacts?.per_100g?.fat)}
            onChangeText={(text) => handleChange('fat', text)}
            keyboardType="numeric"
            numericOnly
            allowDecimal={true}
            error={errors.fat}
          />
        </FormGroup>

        <FormGroup
          label={`${i18n.t('admin.ingredients.nutritionalFacts.carbs')} (${i18n.t('admin.ingredients.nutritionalFacts.unit.grams')})`}
          className={isSmall ? "w-full" : "flex-1 min-w-[45%]"}
          required={true}
        >
          <TextInput
            value={formatValue(nutritionalFacts?.per_100g?.carbohydrates)}
            onChangeText={(text) => handleChange('carbohydrates', text)}
            keyboardType="numeric"
            numericOnly
            allowDecimal={true}
            error={errors.carbohydrates}
          />
        </FormGroup>
      </View>
    </FormSection>
  );
}
