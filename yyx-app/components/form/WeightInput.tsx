import React, { useState, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { TextInput } from '@/components/form/TextInput';
import i18n from '@/i18n';

interface WeightInputProps {
  value: string;
  onChangeValue: (value: string) => void;
  measurementSystem: 'metric' | 'imperial';
  label?: string;
  error?: string;
  onErrorChange?: (error: string | undefined) => void;
  className?: string; // Add className support
  containerClassName?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function WeightInput({
  value,
  onChangeValue,
  measurementSystem,
  label,
  error,
  onErrorChange,
  className = '',
  containerClassName = '',
  containerStyle
}: WeightInputProps) {
  const [internalValue, setInternalValue] = useState(value);
  const [displayValue, setDisplayValue] = useState('');
  const [validationError, setValidationError] = useState<string | undefined>(error);

  useEffect(() => {
    if (error !== validationError) {
      setValidationError(error);
    }
  }, [error]);

  useEffect(() => {
    if (onErrorChange) {
      onErrorChange(validationError);
    }
  }, [validationError, onErrorChange]);

  useEffect(() => {
    if (value !== internalValue) {
      setInternalValue(value);
      updateDisplayValue(value);
    }
  }, [value, measurementSystem]);

  const updateDisplayValue = (val: string) => {
    if (!val) {
      setDisplayValue('');
      return;
    }
    const numValue = parseFloat(val);
    if (isNaN(numValue)) {
      setDisplayValue('');
      return;
    }

    if (measurementSystem === 'imperial') {
      // Convert kg to lb with proper rounding to maintain original input
      const lbs = numValue * 2.20462;
      setDisplayValue(lbs.toFixed(1));
    } else {
      setDisplayValue(numValue.toFixed(1));
    }
  };

  const validateMetricValue = (text: string): boolean => {
    if (text === '') return true;
    const numValue = parseFloat(text);
    return !isNaN(numValue) && numValue >= 0 && numValue < 500;
  };

  const validateImperialValue = (text: string): boolean => {
    if (text === '') return true;
    const numValue = parseFloat(text);
    return !isNaN(numValue) && numValue >= 0 && numValue < 1000; // 500 kg in lbs
  };

  const handleChange = (text: string) => {
    // Allow empty value, whole numbers, or numbers with up to 1 decimal place
    if (text === '' || /^\d*\.?\d{0,2}$/.test(text)) {
      setDisplayValue(text);

      if (text === '') {
        setInternalValue('');
        onChangeValue('');
        setValidationError(undefined);
        return;
      }

      const numValue = parseFloat(text);
      if (!isNaN(numValue)) {
        if (measurementSystem === 'imperial') {
          if (!validateImperialValue(text)) {
            setValidationError(i18n.t('validation.maxValue', { max: 1000 }));
            return;
          }
          // Convert lbs to kg, maintaining more precision
          const kg = (numValue / 2.20462).toFixed(4);
          setInternalValue(kg);
          onChangeValue(kg);
        } else {
          if (!validateMetricValue(text)) {
            setValidationError(i18n.t('validation.maxValue', { max: 500 }));
            return;
          }
          setInternalValue(text);
          onChangeValue(text);
        }
        setValidationError(undefined);
      }
    }
  };

  return (
    <TextInput
      label={label}
      value={displayValue}
      onChangeText={handleChange}
      placeholder={i18n.t('profile.personalData.weightPlaceholder')}
      keyboardType="decimal-pad"
      suffix={measurementSystem === 'metric' ? i18n.t('profile.personalData.kg') : i18n.t('profile.personalData.lb')}
      error={validationError || error}
      className={className}
      containerClassName={containerClassName}
      containerStyle={containerStyle}
    />
  );
}
