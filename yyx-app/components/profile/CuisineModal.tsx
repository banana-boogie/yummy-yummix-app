import React, { useState, useEffect } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, ActivityIndicator, Pressable, Keyboard, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import { CuisinePreference, PreferenceOption } from '@/types/dietary';
import { getCuisineIcon } from '@/constants/dietaryIcons';
import i18n from '@/i18n';
import { SelectableCard } from '@/components/common/SelectableCard';
import { Button } from '@/components/common/Button';
import { Feather } from '@expo/vector-icons';
import { useDevice } from '@/hooks/useDevice';
import { useLanguage } from '@/contexts/LanguageContext';
import preferencesService from '@/services/preferencesService';

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
  const [cuisineOptions, setCuisineOptions] = useState<PreferenceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const { isWeb } = useDevice();
  const { language } = useLanguage();

  useEffect(() => {
    setCuisines(currentCuisines);
  }, [currentCuisines]);

  useEffect(() => {
    async function loadOptions() {
      if (!visible) return;
      try {
        setLoading(true);
        const options = await preferencesService.getCuisinePreferences(language as 'en' | 'es');
        setCuisineOptions(options);
      } catch (err) {
        console.error('Failed to load cuisine options:', err);
      } finally {
        setLoading(false);
      }
    }

    loadOptions();
  }, [visible, language]);

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
            <View className="flex-row justify-between items-center mb-lg">
              <Text preset="h1" className="flex-1 text-center">
                {i18n.t('profile.personalData.cuisinePreferences')}
              </Text>
              <TouchableOpacity onPress={onClose} className="absolute right-0 p-1">
                <Feather name="x" size={24} className="text-text-default" />
              </TouchableOpacity>
            </View>

            <Text preset="bodySmall" className="text-text-secondary text-center mb-md">
              {i18n.t('profile.personalData.cuisineSubtitle')}
            </Text>

            {loading ? (
              <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#FFBFB7" />
              </View>
            ) : (
              <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
              >
                <View className="gap-sm">
                  {cuisineOptions.map((cuisine) => (
                    <SelectableCard
                      key={cuisine.slug}
                      selected={cuisines.includes(cuisine.slug as CuisinePreference)}
                      onPress={() => handleSelect(cuisine.slug as CuisinePreference)}
                      label={cuisine.name}
                      className="mb-xs"
                      icon={getCuisineIcon(cuisine.slug)}
                    />
                  ))}
                </View>
              </ScrollView>
            )}

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
