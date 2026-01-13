import React, { useState, useEffect } from 'react';
import { ViewStyle, NativeSyntheticEvent, TextInputChangeEventData, StyleProp } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import i18n from '@/i18n';
import { TextInput } from './TextInput';

interface EmailInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  className?: string; // Add className support
  containerClassName?: string;
  containerStyle?: StyleProp<ViewStyle>;
  showError?: boolean;
  onValidation?: (isValid: boolean) => void;
  placeholderTextColor?: string;
  label?: string;
  helperText?: string;
}

export const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export function EmailInput({
  value,
  onChangeText,
  placeholder = "email@example.com",
  error,
  className = '',
  containerClassName = '',
  containerStyle,
  showError = true,
  onValidation,
  placeholderTextColor,
  label,
  helperText,
}: EmailInputProps) {
  const [localError, setLocalError] = useState<string>('');
  const [touched, setTouched] = useState(false);

  // Validate email whenever the value changes
  useEffect(() => {
    if (value) {
      setTouched(true);
      validateEmail(value);
    }
  }, [value]);

  const handleChangeText = (text: string) => {
    onChangeText(text);
  };

  const validateEmail = (text: string) => {
    if (text.length >= 5) {
      const isValid = isValidEmail(text);
      if (!isValid) {
        setLocalError(i18n.t('auth.errors.invalidEmail'));
      } else {
        setLocalError('');
      }
      onValidation?.(isValid);
    } else {
      setLocalError('');
      onValidation?.(false);
    }
  };

  const handleFocus = () => { };

  const handleBlur = () => {
    setTouched(true);
    validateEmail(value);
  };

  const handleChange = (e: NativeSyntheticEvent<TextInputChangeEventData>) => {
    const text = e.nativeEvent.text;
    if (text !== value) {
      handleChangeText(text);
    }
  };

  // Only show the error if showError is true and we have an error to show
  const displayError = showError ? (error || (touched && localError ? localError : undefined)) : undefined;

  return (
    <TextInput
      value={value}
      onChangeText={handleChangeText}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      keyboardType="email-address"
      autoCapitalize="none"
      autoComplete="email"
      textContentType="emailAddress"
      leftIcon={<FontAwesome name="envelope" size={20} className="text-text-secondary" />}
      error={displayError}
      label={label}
      helperText={helperText}
      containerClassName={containerClassName}
      containerStyle={containerStyle}
      className={className}
    />
  );
}
