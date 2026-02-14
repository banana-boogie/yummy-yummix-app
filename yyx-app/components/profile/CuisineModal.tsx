import React, { useState, useEffect } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, Pressable, Keyboard, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { CuisinePreference, CUISINE_PREFERENCES } from '@/types/dietary';
import { getCuisineIcon } from '@/constants/dietaryIcons';
import i18n from '@/i18n';
import { SelectableCard } from '@/components/common/SelectableCard';
import { Button } from '@/components/common/Button';
import { Feather } from '@expo/vector-icons';
import { useDevice } from '@/hooks/useDevice';

interface CuisineModalProps {
  visible: boolean;
  onClose: () => void;
  currentCuisines: CuisinePreference[];
  onSave: (cuisines: CuisinePreference[]) => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function CuisineModal({
  visible,
  onClose,
  currentCuisines,
  onSave,
  className = '',
  style,
}: CuisineModalProps) {
  const [cuisines, setCuisines] = useState<CuisinePreference[]>(currentCuisines);
  const { isWeb } = useDevice();

  useEffect(() => {
    setCuisines(currentCuisines);
  }, [currentCuisines]);

  const handleSelect = (cuisineSlug: CuisinePreference) => {
    if (cuisines.includes(cuisineSlug)) {
      setCuisines(cuisines.filter(c => c !== cuisineSlug));
    } else {
      setCuisines([...cuisines, cuisineSlug]);
    }
  };

  const handleSave = () => {
    onSave(cuisines);
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
              {i18n.t('profile.personalData.cuisinePreferences')}
            </Text>

            <Text preset="bodySmall" className="text-text-secondary text-center mb-md">
              {i18n.t('profile.personalData.cuisineSubtitle')}
            </Text>

            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              <View className="gap-sm">
                {CUISINE_PREFERENCES.map((cuisine) => (
                  <SelectableCard
                    key={cuisine}
                    selected={cuisines.includes(cuisine)}
                    onPress={() => handleSelect(cuisine)}
                    label={i18n.t(`onboarding.steps.cuisines.options.${cuisine}`)}
                    className="mb-xs"
                    icon={getCuisineIcon(cuisine)}
                  />
                ))}
              </View>
            </ScrollView>

            <View className="pt-md border-t border-grey-default">
              <Button
                label={i18n.t('common.save')}
                onPress={handleSave}
                className="mt-xs"
              />
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
