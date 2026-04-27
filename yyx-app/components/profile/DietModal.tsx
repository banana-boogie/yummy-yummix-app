import React, { useState, useEffect } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { DietType, SELECTABLE_DIET_TYPES } from '@/types/dietary';
import { getDietTypeIcon } from '@/constants/dietaryIcons';
import i18n from '@/i18n';
import { SelectableCard } from '@/components/common/SelectableCard';
import { Button } from '@/components/common/Button';
import { Feather } from '@expo/vector-icons';
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
  onSave,
  className = '',
  style,
}: DietModalProps) {
  const [dietTypes, setDietTypes] = useState<DietType[]>(currentDietTypes);
  const { isWeb } = useDevice();

  useEffect(() => {
    setDietTypes(currentDietTypes);
  }, [currentDietTypes]);

  const handleSelect = (dietType: DietType) => {
    let newDietTypes: DietType[];
    if (dietTypes.includes(dietType)) {
      newDietTypes = dietTypes.filter(d => d !== dietType);
    } else {
      newDietTypes = [...dietTypes, dietType];
    }
    setDietTypes(newDietTypes);
  };

  const handleSave = () => {
    onSave(dietTypes, []);
    onClose();
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
              <View className="items-end mb-xs">
                <TouchableOpacity onPress={onClose} className="p-1">
                  <Feather name="x" size={24} className="text-text-default" />
                </TouchableOpacity>
              </View>
              <Text preset="h1" className="text-center mb-lg">
                {i18n.t('profile.personalData.diet')}
              </Text>

              <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
              >
                <View className="gap-sm">
                  {SELECTABLE_DIET_TYPES.map((dietType) => (
                    <React.Fragment key={dietType}>
                      <SelectableCard
                        selected={dietTypes.includes(dietType)}
                        onPress={() => handleSelect(dietType)}
                        label={i18n.t(`onboarding.steps.diet.options.${dietType}`)}
                        className="mb-xs"
                        icon={getDietTypeIcon(dietType)}
                      />
                    </React.Fragment>
                  ))}
                </View>
              </ScrollView>

              <View className="pt-md border-t border-grey-default">
                <Button
                  label={i18n.t('common.save')}
                  onPress={handleSave}
                  disabled={false}
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
