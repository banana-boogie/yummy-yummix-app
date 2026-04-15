import React, { useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Text } from '@/components/common/Text';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/common/Button';

interface MultiSelectOption {
  label: string;
  value: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onValueChange: (values: string[]) => void;
  placeholder?: string;
  /** Heading shown at the top of the picker. Falls back to `placeholder`. */
  title?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

const isWeb = Platform.OS === 'web';

interface HeaderProps {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function Header({ title, onCancel, onConfirm }: HeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-lg py-md border-b border-primary-default bg-background-secondary">
      <Button variant="secondary" size="small" onPress={onCancel} label="Cancel" />
      <Text
        preset="subheading"
        numberOfLines={1}
        className="flex-1 text-center px-md"
      >
        {title}
      </Text>
      <Button variant="primary" size="small" onPress={onConfirm} label="Done" />
    </View>
  );
}

interface OptionsListProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  maxHeight?: number;
}

function OptionsList({ options, selectedValues, onToggle, maxHeight }: OptionsListProps) {
  return (
    <ScrollView
      className="px-md py-sm"
      style={maxHeight ? { maxHeight } : undefined}
      contentContainerStyle={{ paddingBottom: 8 }}
    >
      {options.length === 0 ? (
        <Text preset="caption" className="py-lg text-center">
          No options available
        </Text>
      ) : (
        options.map((option) => {
          const isSelected = selectedValues.includes(option.value);
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => onToggle(option.value)}
              className={`
                flex-row items-center py-sm px-md rounded-md
                web:hover:bg-primary-lightest web:transition-colors web:cursor-pointer
                ${isSelected ? 'bg-primary-lighter' : ''}
              `}
            >
              <View className="flex-1 flex-row items-center">
                <View className="w-6 mr-sm items-center">
                  {isSelected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      className="text-primary-darkest"
                    />
                  ) : (
                    <View className="w-6 h-6 rounded-full border-2 border-primary-default" />
                  )}
                </View>
                <Text
                  className={`text-base flex-1 text-text-default ${
                    isSelected ? 'font-semibold' : ''
                  }`}
                >
                  {option.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

export function MultiSelect({
  options,
  selectedValues,
  onValueChange,
  placeholder = 'Select options',
  title,
  className = '',
  style,
  containerStyle,
}: MultiSelectProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [tempSelectedValues, setTempSelectedValues] = useState<string[]>(selectedValues);

  const headerTitle = title ?? placeholder;

  const openModal = () => {
    setTempSelectedValues(selectedValues);
    setModalVisible(true);
  };

  const toggleOption = (value: string) => {
    setTempSelectedValues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleConfirm = () => {
    onValueChange(tempSelectedValues);
    setModalVisible(false);
  };

  const handleCancel = () => {
    setTempSelectedValues(selectedValues);
    setModalVisible(false);
  };

  // ESC to close on web
  useEffect(() => {
    if (!isWeb || !modalVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalVisible]);

  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label)
    .join(', ');

  return (
    <View className={className} style={[style, containerStyle]}>
      <TouchableOpacity
        className="flex-row items-center justify-between h-12 px-md bg-background-secondary rounded-lg"
        onPress={openModal}
      >
        <Text
          className={`flex-1 text-base ${
            selectedLabels ? 'text-text-default' : 'text-text-secondary'
          }`}
          numberOfLines={1}
        >
          {selectedLabels || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={24} className="text-text-secondary" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType={isWeb ? 'fade' : 'slide'}
        onRequestClose={handleCancel}
      >
        {isWeb ? (
          <Pressable
            onPress={handleCancel}
            className="flex-1 items-center justify-center bg-black/50 web:fixed web:inset-0"
          >
            <Pressable
              // Prevent backdrop dismiss when clicking inside the dialog.
              onPress={(e) => {
                const anyEvt = e as unknown as { stopPropagation?: () => void };
                anyEvt.stopPropagation?.();
              }}
              className="w-full items-center px-md"
            >
              <View
                accessibilityRole={'dialog' as never}
                accessibilityViewIsModal
                className="w-full web:max-w-[420px] mx-auto rounded-xl bg-white border border-primary-default shadow-lg overflow-hidden"
                style={{ maxHeight: 560 }}
              >
                <Header
                  title={headerTitle}
                  onCancel={handleCancel}
                  onConfirm={handleConfirm}
                />
                <OptionsList
                  options={options}
                  selectedValues={tempSelectedValues}
                  onToggle={toggleOption}
                  maxHeight={420}
                />
              </View>
            </Pressable>
          </Pressable>
        ) : (
          <View className="flex-1 justify-end bg-black/50">
            <View
              accessibilityRole={'dialog' as never}
              accessibilityViewIsModal
              className="bg-white rounded-t-2xl border-t border-primary-default"
              style={{ maxHeight: '80%' }}
            >
              <Header
                title={headerTitle}
                onCancel={handleCancel}
                onConfirm={handleConfirm}
              />
              <OptionsList
                options={options}
                selectedValues={tempSelectedValues}
                onToggle={toggleOption}
              />
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}
