import React, { useState, useEffect } from 'react';
import { View, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { TextInput } from '@/components/form/TextInput';
import i18n from '@/i18n';

interface HeightInputProps {
  value: string;
  onChangeValue: (value: string) => void;
  measurementSystem: 'metric' | 'imperial';
  label?: string;
  error?: string;
  onErrorChange?: (error: string | undefined) => void;
  className?: string; // Add className support
  containerClassName?: string;
  inputStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

export function HeightInput({
  value,
  onChangeValue,
  measurementSystem,
  label,
  error,
  onErrorChange,
  className = '',
  containerClassName = '',
  inputStyle,
  containerStyle
}: HeightInputProps) {
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');
  const [internalValue, setInternalValue] = useState(value);
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
      if (measurementSystem === 'imperial' && value) {
        const cm = parseFloat(value) || 0;
        const totalInches = cm / 2.54;
        const ft = Math.floor(totalInches / 12);
        const inch = Math.round(totalInches % 12);
        if (inch === 12) {
          setFeet((ft + 1).toString());
          setInches('0');
        } else if (ft.toString() !== feet || inch.toString() !== inches) {
          setFeet(ft.toString());
          setInches(inch.toString());
        }
      }
    }
  }, [value, measurementSystem, internalValue]);

  const validateMetricValue = (text: string): boolean => {
    if (text === '') return true;
    const numValue = parseFloat(text);
    return !isNaN(numValue) && numValue >= 0 && numValue < 300;
  };

  const validateImperialValue = (ft: string, inch: string): boolean => {
    if (ft === '' && inch === '') return true;
    const feetValue = parseInt(ft) || 0;
    const inchesValue = parseInt(inch) || 0;
    const totalInches = feetValue * 12 + inchesValue;
    return totalInches >= 0 && totalInches < 118; // 118 inches = 300 cm
  };

  const handleMetricChange = (text: string) => {
    // Allow empty value, whole numbers, or numbers with up to 2 decimal places
    if (text === '' || /^\d{0,3}\.?\d{0,2}$/.test(text)) {
      const newValue = text === '' || text === '0' ? '' : text;

      if (!validateMetricValue(newValue)) {
        setValidationError(i18n.t('validation.maxValue', { max: 299.99 }));
        return;
      }

      setValidationError(undefined);
      if (newValue !== value) {
        setInternalValue(newValue);
        onChangeValue(newValue);
      }
    }
  };

  const handleFeetChange = (text: string) => {
    if (text === '' || /^\d{0,2}$/.test(text)) {
      setFeet(text);
      const ft = parseInt(text) || 0;
      const inch = parseInt(inches) || 0;

      if (!validateImperialValue(text, inches)) {
        setValidationError(i18n.t('validation.maxValue', { max: 9 }));
        return;
      }

      setValidationError(undefined);
      const totalInches = ft * 12 + inch;
      const cm = Math.round(totalInches * 2.54);
      const newValue = totalInches > 0 ? cm.toString() : '';

      if (newValue !== value) {
        setInternalValue(newValue);
        onChangeValue(newValue);
      }
    }
  };

  const handleInchesChange = (text: string) => {
    if (text === '' || /^\d{0,2}$/.test(text)) {
      const inchValue = parseInt(text) || 0;
      if (text === '' || inchValue <= 11) {
        setInches(text);

        if (!validateImperialValue(feet, text)) {
          setValidationError(i18n.t('validation.maxValue', { max: 11 }));
          return;
        }

        setValidationError(undefined);
        const ft = parseInt(feet) || 0;
        const totalInches = ft * 12 + inchValue;
        const cm = Math.round(totalInches * 2.54);
        const newValue = totalInches > 0 ? cm.toString() : '';

        if (newValue !== value) {
          setInternalValue(newValue);
          onChangeValue(newValue);
        }
      }
    }
  };

  if (measurementSystem === 'metric') {
    return (
      <TextInput
        label={label}
        value={value}
        onChangeText={handleMetricChange}
        keyboardType="decimal-pad"
        placeholder={i18n.t('profile.personalData.heightPlaceholder')}
        suffix={i18n.t('profile.personalData.cm')}
        error={validationError || error}
        className={className}
        containerClassName={containerClassName}
        containerStyle={containerStyle}
        style={inputStyle}
      />
    );
  }

  return (
    <View className={`gap-2 ${containerClassName}`} style={containerStyle}>
      {label && (
        <Text preset="body" className="mb-1">
          {label}
        </Text>
      )}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <TextInput
            value={feet}
            onChangeText={handleFeetChange}
            keyboardType="number-pad"
            placeholder="0"
            suffix={i18n.t('profile.personalData.ft')}
            error={validationError}
            className={className}
          />
        </View>
        <View className="flex-1">
          <TextInput
            value={inches}
            onChangeText={handleInchesChange}
            keyboardType="number-pad"
            placeholder="0"
            suffix={i18n.t('profile.personalData.in')}
            error={validationError}
            className={className}
          />
        </View>
      </View>
      {error && !validationError && (
        <Text preset="caption" className="text-status-error">
          {error}
        </Text>
      )}
    </View>
  );
}
