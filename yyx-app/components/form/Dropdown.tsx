import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Modal, Platform, StyleProp, ViewStyle } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/form/TextInput';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';

interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownProps {
  placeholder?: string;
  options: DropdownOption[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  label?: string;
  error?: string;
  allowCustomInput?: boolean;
  customInputValue?: string;
  onCustomInputChange?: (value: string) => void;
  className?: string; // Add className support
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>; // Backward compatibility
}

/**
 * Dropdown component that supports both selection from predefined options
 * and custom text input when needed.
 */
export function Dropdown({
  placeholder = 'Select an option',
  options,
  selectedValue,
  onValueChange,
  label,
  error,
  allowCustomInput = false,
  customInputValue,
  onCustomInputChange,
  className = '',
  style,
  containerStyle
}: DropdownProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [tempValue, setTempValue] = useState(selectedValue);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [tempCustomValue, setTempCustomValue] = useState(customInputValue || '');
  const isWeb = Platform.OS === 'web';

  // Update the temp values when props change
  useEffect(() => {
    setTempValue(selectedValue);
    setTempCustomValue(customInputValue || '');

    // If selected value isn't in the options, assume it's a custom value
    if (allowCustomInput &&
      selectedValue &&
      !options.some(option => option.value === selectedValue)) {
      setShowCustomInput(true);
    } else {
      setShowCustomInput(false);
    }
  }, [selectedValue, customInputValue, options, allowCustomInput]);

  const selectedOption = options.find(option => option.value === selectedValue);
  const displayText = showCustomInput ?
    customInputValue || placeholder :
    (selectedOption?.label || placeholder);

  const handleConfirm = () => {
    if (showCustomInput && onCustomInputChange) {
      onCustomInputChange(tempCustomValue);
    } else if (tempValue !== selectedValue) {
      onValueChange(tempValue);
    }
    setModalVisible(false);
  };

  const handleCancel = () => {
    setTempValue(selectedValue);
    setTempCustomValue(customInputValue || '');
    setShowCustomInput(options.some(option => option.value === 'custom') ?
      selectedValue === 'custom' : false);
    setModalVisible(false);
  };

  const handleClearCustomInput = () => {
    setShowCustomInput(false);
    onValueChange(options[0]?.value || '');
  };

  // Web version
  if (isWeb) {
    return (
      <View className={`gap-1 ${className}`} style={[style, containerStyle]}>
        {label && <Text className="text-text-default text-sm mb-1">{label}</Text>}

        {allowCustomInput && showCustomInput ? (
          <View className="w-full">
            <View className="relative">
              <TextInput
                value={customInputValue}
                onChangeText={value => onCustomInputChange?.(value)}
                placeholder={placeholder}
                rightIcon="close-circle"
                containerStyle={{ width: '100%' }}
              />
              <TouchableOpacity
                className="absolute right-3 top-3 z-10"
                onPress={handleClearCustomInput}
              >
                <Ionicons name="close-circle" size={20} className="text-text-secondary" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View className="relative h-12 rounded-lg bg-background-secondary overflow-hidden">
            <select
              value={selectedValue}
              onChange={(e) => {
                const newValue = e.target.value;
                if (newValue === 'custom' && allowCustomInput) {
                  setShowCustomInput(true);
                  return;
                }
                onValueChange(newValue);
              }}
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'transparent',
                color: selectedOption ? COLORS.neutral.black : COLORS.text.secondary, // Tailwind text-default / text-secondary
                border: 'none',
                padding: '0 16px',
                fontSize: 16,
                appearance: 'none',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {placeholder && (
                <option value="" disabled={selectedValue !== ''}>
                  {placeholder}
                </option>
              )}
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              {allowCustomInput && (
                <option value="custom">Custom Value...</option>
              )}
            </select>
            <View className="absolute right-4 top-3">
              <Ionicons name="chevron-down" size={24} className="text-text-secondary" />
            </View>
          </View>
        )}

        {error && (
          <Text className="text-status-error text-sm">{error}</Text>
        )}
      </View>
    );
  }

  // Mobile version with modal
  return (
    <View className={`gap-1 ${className}`} style={[style, containerStyle]}>
      {label && <Text className="text-text-default text-sm mb-1">{label}</Text>}

      <TouchableOpacity
        className="flex-row items-center justify-between h-12 px-md bg-background-secondary rounded-lg"
        onPress={() => setModalVisible(true)}
      >
        <Text
          className={`flex-1 ${!selectedOption && !showCustomInput ? 'text-text-secondary' : 'text-text-default'}`}
          numberOfLines={1}
        >
          {displayText}
        </Text>
        <Ionicons name="chevron-down" size={24} className="text-text-secondary" />
      </TouchableOpacity>

      {error && (
        <Text className="text-status-error text-sm">{error}</Text>
      )}

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-background rounded-t-2xl pb-iphone-bottom">
            <View className="flex-row justify-between items-center p-md border-b border-border-default">
              <Button
                variant="secondary"
                onPress={handleCancel}
                label="Cancel"
                size="small"
              />
              <Text className="flex-1 text-center font-semibold">{label || placeholder}</Text>
              <Button
                variant="primary"
                onPress={handleConfirm}
                label="Done"
                size="small"
              />
            </View>

            {allowCustomInput && (
              <View className="flex-row border-b border-border-default">
                <TouchableOpacity
                  className={`flex-1 items-center py-sm ${!showCustomInput ? 'border-b-2 border-primary-medium' : ''}`}
                  onPress={() => setShowCustomInput(false)}
                >
                  <Text className={!showCustomInput ? 'text-primary-medium font-semibold' : 'text-text-secondary'}>
                    Choose from List
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`flex-1 items-center py-sm ${showCustomInput ? 'border-b-2 border-primary-medium' : ''}`}
                  onPress={() => setShowCustomInput(true)}
                >
                  <Text className={showCustomInput ? 'text-primary-medium font-semibold' : 'text-text-secondary'}>
                    Custom Value
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {showCustomInput ? (
              <View className="p-md">
                <TextInput
                  value={tempCustomValue}
                  onChangeText={setTempCustomValue}
                  placeholder="Enter custom value"
                  autoFocus
                />
              </View>
            ) : (
              <View className="h-[216px]">
                <Picker
                  selectedValue={tempValue}
                  onValueChange={setTempValue}
                  className="h-[216px]"
                >
                  {options.map((option) => (
                    <Picker.Item
                      key={option.value}
                      label={option.label}
                      value={option.value}
                      color={COLORS.neutral.black} // Tailwind text-default
                    />
                  ))}
                </Picker>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
