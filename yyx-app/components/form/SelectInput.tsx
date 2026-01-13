import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Modal, Platform, ViewStyle, StyleProp } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { Ionicons } from '@expo/vector-icons';

// This type matches the SelectItem interface from the common Select component
export interface SelectOption {
  label: string;
  value: string;
}

interface SelectInputProps {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  options?: SelectOption[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  className?: string; // Add className support
  containerClassName?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function SelectInput({
  label,
  value,
  onValueChange,
  options = [],
  placeholder = 'Select an option',
  error,
  required,
  className = '',
  containerClassName = '',
  containerStyle
}: SelectInputProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  const selectedItem = options.find(item => item.value === value);
  const displayText = selectedItem?.label || '';

  const handleConfirm = () => {
    if (tempValue !== value) {
      onValueChange(tempValue);
    }
    setModalVisible(false);
  };

  const handleCancel = () => {
    setTempValue(value);
    setModalVisible(false);
  };

  // Web version using native select element
  if (isWeb) {
    return (
      <View className={containerClassName} style={containerStyle}>
        {label ? (
          <Text className="text-xs text-text-default ml-xxs font-semibold">
            {label} {required ? '*' : ''}
          </Text>
        ) : null}
        <View className="flex-row items-center justify-between rounded-md bg-background-secondary overflow-hidden p-sm border-1.5 border-border-default relative">
          <select
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
              zIndex: 2
            }}
          >
            {placeholder ? (
              <option value="" disabled={value !== ''}>
                {placeholder}
              </option>
            ) : null}
            {options.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          {/* Visual representation */}
          <Text
            className={`
              text-base mb-0 flex-1
              ${!selectedItem ? 'text-text-secondary' : 'text-text-default'}
            `}
            numberOfLines={1}
          >
            {displayText}
          </Text>
          <View>
            <Ionicons name="chevron-down" size={24} className="text-text-secondary" />
          </View>
        </View>
        {error ? (
          <Text className="text-status-error text-sm">{error}</Text>
        ) : null}
      </View>
    );
  }

  // Mobile version with modal
  return (
    <View className={containerClassName} style={containerStyle}>
      {label ? (
        <Text preset="body" className="text-xs text-text-default ml-xxs">
          {label} {required ? '*' : ''}
        </Text>
      ) : null}
      <TouchableOpacity
        className={`
          flex-row items-center justify-between h-12 px-md bg-background-secondary rounded-md
          ${error ? 'border border-status-error' : ''}
          ${className}
        `}
        onPress={() => setModalVisible(true)}
      >
        <Text
          className={`
            flex-1 text-md
            ${!selectedItem ? 'text-text-secondary' : 'text-text-default'}
            ${error ? 'text-status-error' : ''}
          `}
          numberOfLines={1}
        >
          {displayText}
        </Text>
        <Ionicons name="chevron-down" size={24} className="text-text-secondary" />
      </TouchableOpacity>

      {error ? (
        <Text className="text-status-error text-sm">{error}</Text>
      ) : null}

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
      >
        <View className="flex-1 justify-end bg-black/50">
          <View
            className="bg-white rounded-t-xl"
            style={{
              paddingBottom: Platform.OS === 'ios' ? 40 : 0,
              backgroundColor: 'white'
            }}
          >
            <View className="flex-row justify-between items-center p-md border-b border-border-default">
              <Button
                variant="secondary"
                onPress={handleCancel}
                label="Cancel"
                size="small"
              />
              <Text preset="body" className="flex-1 text-center font-bold">{label}</Text>
              <Button
                variant="primary"
                onPress={handleConfirm}
                label="Done"
                size="small"
              />
            </View>
            <View className="h-[216px]">
              <Picker
                selectedValue={tempValue}
                onValueChange={setTempValue}
                className="h-[216px]"
              >
                {options.map((item) => (
                  <Picker.Item
                    key={item.value}
                    label={item.label}
                    value={item.value}
                    color="#000000" // Standard black for picker items
                  />
                ))}
              </Picker>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
