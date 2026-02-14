import React, { useState, useRef, useEffect } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { DietaryRestriction, DIETARY_RESTRICTIONS } from '@/types/dietary';
import { getDietaryRestrictionIcon } from '@/constants/dietaryIcons';
import i18n from '@/i18n';
import { SelectableCard } from '@/components/common/SelectableCard';
import { Button } from '@/components/common/Button';
import { Feather } from '@expo/vector-icons';
import { OtherInputField } from '@/components/form/OtherInputField';
import { useDevice } from '@/hooks/useDevice';

interface DietaryRestrictionsModalProps {
  visible: boolean;
  onClose: () => void;
  currentRestrictions: DietaryRestriction[];
  currentOtherAllergies: string[];
  onSave: (restrictions: DietaryRestriction[], otherAllergies: string[]) => void;
  title?: string;
  className?: string; // Add className
  style?: StyleProp<ViewStyle>;
}

export function DietaryRestrictionsModal({
  visible,
  onClose,
  currentRestrictions,
  currentOtherAllergies,
  onSave,
  title,
  className = '',
  style,
}: DietaryRestrictionsModalProps) {
  const [restrictions, setRestrictions] = useState<DietaryRestriction[]>(currentRestrictions);
  const [otherAllergies, setOtherAllergies] = useState<string[]>(
    currentOtherAllergies.length > 0 ? currentOtherAllergies : ['']
  );
  const [error, setError] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const { isWeb } = useDevice();

  useEffect(() => {
    setRestrictions(currentRestrictions);
    setOtherAllergies(currentOtherAllergies.length > 0 ? currentOtherAllergies : ['']);
  }, [currentRestrictions, currentOtherAllergies]);

  const handleSelect = (restriction: DietaryRestriction) => {
    if (restriction === 'none') {
      setRestrictions(['none']);
      setOtherAllergies([]);
      setError('');
      return;
    }

    let newRestrictions: DietaryRestriction[];
    if (restrictions.includes(restriction)) {
      newRestrictions = restrictions.filter(r => r !== restriction);
      if (restriction === 'other') {
        setOtherAllergies([]);
      }
    } else {
      newRestrictions = [...restrictions.filter(r => r !== 'none'), restriction];

      // If user selects "other", initialize a blank allergy input
      if (restriction === 'other') {
        setOtherAllergies(['']);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    }
    setRestrictions(newRestrictions);
  };

  const handleAddOtherAllergy = () => {
    setOtherAllergies([...otherAllergies, '']);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleOtherAllergyChange = (newAllergies: string[]) => {
    setOtherAllergies(newAllergies);
    setError('');
  };

  const handleSave = () => {
    if (!restrictions.length) return;

    if (restrictions.includes('other')) {
      const validAllergies = otherAllergies.filter(a => a.trim().length > 0);
      if (validAllergies.length > 0) {
        onSave(restrictions, validAllergies);
        onClose();
      } else {
        setError(i18n.t('validation.otherAllergyRequired'));
        scrollViewRef.current?.scrollToEnd({ animated: true });
        return;
      }
    } else {
      onSave(restrictions, []);
      onClose();
    }
  };

  const handleRemoveOtherAllergy = (indexToRemove: number) => {
    const newOtherAllergies = otherAllergies.filter((_, index) => index !== indexToRemove);
    setOtherAllergies(newOtherAllergies);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable
        onPress={(e: any) => {
          if (Platform.OS === 'web') {
            const target = e.target as HTMLElement | null;
            if (target?.tagName === 'INPUT') {
              e.stopPropagation();
              return;
            }
          }
          Keyboard.dismiss();
        }}
        className="flex-1 bg-black/50"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <View className={`flex-1 ${isWeb ? 'justify-center items-center p-md' : 'justify-end'}`}>
            <View
              className={`bg-background-default w-full max-w-[400px] self-center p-lg shadow-md lg:rounded-lg rounded-t-lg ${isWeb ? 'max-h-[80%]' : 'h-[90%]'} ${className}`}
              style={style}
            >
              <View className="items-end mb-xs">
                <TouchableOpacity onPress={onClose} className="p-1">
                  <Feather name="x" size={24} className="text-text-default" />
                </TouchableOpacity>
              </View>
              <Text preset="h1" className="text-center mb-lg">
                {title || i18n.t('profile.personalData.updateDietaryRestrictions')}
              </Text>

              <ScrollView
                ref={scrollViewRef}
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
              >
                <View className="gap-sm">
                  {DIETARY_RESTRICTIONS.map((restriction) => (
                    <React.Fragment key={restriction}>
                      <SelectableCard
                        selected={restrictions.includes(restriction)}
                        onPress={() => handleSelect(restriction)}
                        label={i18n.t(`onboarding.steps.allergies.options.${restriction}`)}
                        className="mb-xs"
                        icon={getDietaryRestrictionIcon(restriction)}
                      />
                      {restriction === 'other' && restrictions.includes('other') && (
                        <OtherInputField
                          items={otherAllergies}
                          onItemsChange={handleOtherAllergyChange}
                          placeholder={i18n.t('onboarding.steps.allergies.otherPlaceholder')}
                          error={error}
                          onAddItem={handleAddOtherAllergy}
                          onRemoveItem={handleRemoveOtherAllergy}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </View>
              </ScrollView>

              <View className="pt-md border-t border-grey-default">
                <Button
                  label={i18n.t('common.save')}
                  onPress={handleSave}
                  disabled={!restrictions.length}
                  className="mt-xs"
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}