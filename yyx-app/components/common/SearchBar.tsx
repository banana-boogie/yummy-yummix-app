// components/SearchBar.tsx
import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { TextInput } from '@/components/form/TextInput';
import { COLORS } from '@/constants/design-tokens';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchBarProps {
  style?: StyleProp<ViewStyle>;
  className?: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  placeholder?: string;
  /** Whether to enable debouncing (default: false) */
  useDebounce?: boolean;
  /** Debounce delay in milliseconds (default: 300) */
  debounceDelay?: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  style,
  className = '',
  searchQuery,
  setSearchQuery,
  placeholder,
  useDebounce: enableDebounce = false,
  debounceDelay = 300
}) => {
  // Local state to track the input value
  const [inputValue, setInputValue] = useState(searchQuery);

  // Apply debounce if enabled
  const debouncedValue = enableDebounce ? useDebounce(inputValue, debounceDelay) : inputValue;

  // Update the search query when debounced value changes
  useEffect(() => {
    if (enableDebounce) {
      setSearchQuery(debouncedValue);
    }
  }, [debouncedValue, setSearchQuery, enableDebounce]);

  // Handle text changes
  const handleChangeText = (text: string) => {
    setInputValue(text);
    if (!enableDebounce) {
      setSearchQuery(text);
    }
  };

  return (
    <View className={`mb-md flex-row items-center ${className}`} style={style}>
      <TextInput
        id="search-bar"
        placeholder={placeholder}
        placeholderTextColor={COLORS.grey.medium}
        value={inputValue}
        onChangeText={handleChangeText}
        leftIcon={<Ionicons
          name="search"
          size={20}
          color={COLORS.grey.medium_dark}
        />}
        className="mr-sm"
      />
      {inputValue.length > 0 && (
        <TouchableOpacity
          onPress={() => {
            setInputValue('');
            setSearchQuery('');
          }}
          className="absolute right-sm"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={20} color={COLORS.grey.medium_dark} />
        </TouchableOpacity>
      )}
    </View>
  );
};