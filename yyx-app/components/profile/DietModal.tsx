import React, { useState, useRef, useEffect } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { DietType, DIET_TYPES } from '@/types/dietary';
import { getDietTypeIcon } from '@/constants/dietaryIcons';
import i18n from '@/i18n';
import { SelectableCard } from '@/components/common/SelectableCard';
import { Button } from '@/components/common/Button';
import { Feather } from '@expo/vector-icons';
import { OtherInputField } from '@/components/form/OtherInputField';
import { useDevice } from '@/hooks/useDevice';

interface DietModalProps {
  visible: boolean;
  onClose: () => void;
  currentDietTypes: DietType[];
  currentOtherDiet: string[];
  onSave: (dietTypes: DietType[], otherDiet: string[]) => void;
  className?: string; // Add className
  style?: StyleProp<ViewStyle>;
}

export function DietModal({
  visible,
  onClose,
  currentDietTypes,
  currentOtherDiet,
  onSave,
  className = '',
  style,
}: DietModalProps) {
  const [dietTypes, setDietTypes] = useState<DietType[]>(currentDietTypes);
  const [otherDiets, setOtherDiets] = useState<string[]>(
    currentOtherDiet.length > 0 ? currentOtherDiet : ['']
  );
  const [error, setError] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const { isWeb, isPhone } = useDevice();

  useEffect(() => {
    setDietTypes(currentDietTypes);
    setOtherDiets(currentOtherDiet.length > 0 ? currentOtherDiet : ['']);
  }, [currentDietTypes, currentOtherDiet]);

  const handleSelect = (dietType: DietType) => {
    if (dietType === 'none') {
      setDietTypes(['none']);
      setOtherDiets([]);
      setError('');
      return;
    }

    let newDietTypes: DietType[];
    if (dietTypes.includes(dietType)) {
      newDietTypes = dietTypes.filter(d => d !== dietType);
      if (dietType === 'other') {
        setOtherDiets([]);
      }
    } else {
      newDietTypes = [...dietTypes.filter(d => d !== 'none'), dietType];

      // If user selects "other", initialize a blank diet input
      if (dietType === 'other') {
        setOtherDiets(['']);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    }
    setDietTypes(newDietTypes);
  };

  const handleAddOtherDiet = () => {
    setOtherDiets([...otherDiets, '']);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleOtherDietChange = (newDiets: string[]) => {
    setOtherDiets(newDiets);
    setError('');
  };

  const handleSave = () => {
    if (!dietTypes.length) return;

    if (dietTypes.includes('other')) {
      const validDiets = otherDiets.filter(d => d.trim().length > 0);
      if (validDiets.length > 0) {
        onSave(dietTypes, validDiets);
        onClose();
      } else {
        setError(i18n.t('validation.otherDietRequired'));
        scrollViewRef.current?.scrollToEnd({ animated: true });
        return;
      }
    } else {
      onSave(dietTypes, []);
      onClose();
    }
  };

  const handleRemoveOtherDiet = (indexToRemove: number) => {
    const newOtherDiets = otherDiets.filter((_, index) => index !== indexToRemove);
    setOtherDiets(newOtherDiets);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable onPress={Keyboard.dismiss} className="flex-1 bg-black/50">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <View className={`flex-1 ${isWeb ? 'justify-center items-center p-md' : 'justify-end'}`}>
            <View
              className={`bg-background-default rounded-lg self-center p-lg shadow-md w-full max-w-[400px] ${isWeb ? 'max-h-[80%] h-auto' : 'h-[90%] rounded-b-none'} ${className}`}
              style={style}
            >
              <View className="flex-row justify-between items-center mb-lg">
                <Text preset="h1" className="flex-1 text-center">
                  {i18n.t('profile.personalData.diet')}
                </Text>
                <TouchableOpacity onPress={onClose} className="absolute right-0 p-1">
                  <Feather name="x" size={24} className="text-text-default" />
                </TouchableOpacity>
              </View>

              <ScrollView
                ref={scrollViewRef}
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
              >
                <View className="gap-sm">
                  {DIET_TYPES.map((dietType) => (
                    <React.Fragment key={dietType}>
                      <SelectableCard
                        selected={dietTypes.includes(dietType)}
                        onPress={() => handleSelect(dietType)}
                        label={i18n.t(`onboarding.steps.diet.options.${dietType}`)}
                        className="mb-xs"
                        icon={getDietTypeIcon(dietType)}
                      />
                      {dietType === 'other' && dietTypes.includes('other') && (
                        <OtherInputField
                          items={otherDiets}
                          onItemsChange={handleOtherDietChange}
                          placeholder={i18n.t('onboarding.steps.diet.otherPlaceholder')}
                          error={error}
                          onAddItem={handleAddOtherDiet}
                          onRemoveItem={handleRemoveOtherDiet}
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
                  disabled={!dietTypes.length}
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