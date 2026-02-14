import React, { useState, useRef, useEffect } from 'react';
import { View, Modal, Platform, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Text, Button } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

interface DatePickerProps {
  label?: string;
  value: Date;
  onChange: (date: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  error?: string;
  className?: string; // Add className support
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>; // Backward compatibility
}

const DEFAULT_DATE = new Date(1969, 4, 18); // May 18, 1969 (months are 0-indexed)

export function DatePicker({
  label,
  value = DEFAULT_DATE,
  onChange,
  maximumDate,
  minimumDate,
  error,
  className = '',
  style,
  containerStyle
}: DatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const isWeb = Platform.OS === 'web';
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Ensure the value is a valid date
  const ensureValidDate = (date: Date | null): Date => {
    if (date instanceof Date && !isNaN(date.getTime())) {
      return date;
    }
    return DEFAULT_DATE;
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selectedDate) {
      setTempDate(selectedDate);
      if (Platform.OS === 'android') {
        onChange(selectedDate);
      }
    }
  };

  const handleConfirm = () => {
    if (tempDate) {
      onChange(tempDate);
    }
    setShowPicker(false);
    setTempDate(null);
  };

  const handleCancel = () => {
    setShowPicker(false);
    setTempDate(null);
  };

  // Format date to YYYY-MM-DD for web input
  const formatDateForWeb = (date: Date) => {
    // Ensure we're working with a valid date
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return `1969-05-18`; // Default to May 18, 1969
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Handle web date input change
  const handleWebDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = e.target.value;
    if (dateString) {
      // Create a new date with the correct timezone handling
      const [year, month, day] = dateString.split('-').map(Number);
      const newDate = new Date(year, month - 1, day);

      // Ensure the date is valid before calling onChange
      if (!isNaN(newDate.getTime())) {
        onChange(newDate);
      }
    }
  };

  // Web version with a more user-friendly approach
  if (isWeb) {
    // Make clicking the container also open the date picker
    const handleContainerClick = () => {
      if (dateInputRef.current) {
        dateInputRef.current.showPicker();
      }
    };

    return (
      <View className={`gap-2 mb-sm ${className}`} style={[style, containerStyle]}>
        {label && (
          <Text preset="body" className="mb-1">
            {label}
          </Text>
        )}

        <TouchableOpacity
          className={`
            bg-background-secondary rounded-lg min-h-[48px] py-2 px-4 flex-row items-center justify-between
            ${error ? 'border border-status-error' : ''}
          `}
          onPress={handleContainerClick}
        >
          <Text className="text-text-default">
            {value instanceof Date && !isNaN(value.getTime())
              ? value.toLocaleDateString()
              : DEFAULT_DATE.toLocaleDateString()}
          </Text>
          <Ionicons name="calendar-outline" size={24} className="text-text-secondary" />

          <input
            ref={dateInputRef}
            type="date"
            value={formatDateForWeb(value)}
            onChange={handleWebDateChange}
            min={minimumDate ? formatDateForWeb(minimumDate) : undefined}
            max={maximumDate ? formatDateForWeb(maximumDate) : undefined}
            style={{
              position: 'absolute',
              opacity: 0,
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              width: '100%',
              height: '100%',
              cursor: 'pointer',
            }}
            aria-label={label || "Date picker"}
          />
        </TouchableOpacity>

        {error && (
          <Text preset="caption" className="text-status-error">
            {error}
          </Text>
        )}
      </View>
    );
  }

  // Initialize tempDate when modal opens
  useEffect(() => {
    if (showPicker) {
      setTempDate(ensureValidDate(value));
    }
  }, [showPicker, value]);

  // Mobile version
  return (
    <View className={`mb-sm ${className}`} style={[style, containerStyle]}>
      {label && (
        <Text className="text-text-default text-sm font-semibold pl-xxs mb-xxs">
          {label}
        </Text>
      )}
      <TouchableOpacity
        onPress={() => setShowPicker(true)}
        className="bg-background-default rounded-md min-h-[56px] px-md flex-row items-center justify-between border-[1.5px] border-border-default"
      >
        <Text preset="body" className="text-text-default">
          {value instanceof Date && !isNaN(value.getTime())
            ? value.toLocaleDateString()
            : DEFAULT_DATE.toLocaleDateString()}
        </Text>
        <Ionicons name="calendar-outline" size={20} color={COLORS.text.secondary} />
      </TouchableOpacity>
      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={ensureValidDate(value)}
          mode="date"
          onChange={handleDateChange}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
        />
      )}
      {showPicker && Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent={true}
          animationType="slide"
        >
          <View className="flex-1 justify-end bg-black/50">
            <View
              className="bg-white rounded-t-2xl pb-10"
              style={{ backgroundColor: COLORS.background.default }}
            >
              <View className="flex-row justify-between items-center p-4 border-b border-border-default">
                <Button
                  variant="secondary"
                  onPress={handleCancel}
                  label={i18n.t('common.cancel')}
                  size="small"
                />
                <Text preset="body" className="flex-1 text-center font-semibold">
                  {label || i18n.t('common.selectDate')}
                </Text>
                <Button
                  variant="primary"
                  onPress={handleConfirm}
                  label={i18n.t('common.done')}
                  size="small"
                />
              </View>
              <DateTimePicker
                value={ensureValidDate(tempDate || value)}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                className="w-full h-[250px] self-center"
                textColor={COLORS.text.default}
              />
            </View>
          </View>
        </Modal>
      )}
      {error && (
        <Text preset="caption" className="text-status-error">
          {error}
        </Text>
      )}
    </View>
  );
}
