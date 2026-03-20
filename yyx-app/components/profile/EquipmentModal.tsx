import React, { useState, useEffect } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, Pressable, Keyboard, Image } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useDevice } from '@/hooks/useDevice';
import i18n from '@/i18n';
import { EQUIPMENT_CONFIG, type EquipmentType, type ThermomixModel } from '@/constants/equipment';
import type { KitchenEquipment } from '@/types/onboarding';

interface EquipmentModalProps {
  visible: boolean;
  onClose: () => void;
  currentEquipment: KitchenEquipment[];
  onSave: (equipment: KitchenEquipment[]) => void;
}

export function EquipmentModal({
  visible,
  onClose,
  currentEquipment,
  onSave,
}: EquipmentModalProps) {
  const [selectedEquipment, setSelectedEquipment] = useState<KitchenEquipment[]>(currentEquipment);
  const [thermomixModel, setThermomixModel] = useState<ThermomixModel | null>(
    currentEquipment.find(e => e.type === 'thermomix')?.model ?? null
  );
  const [showModelError, setShowModelError] = useState(false);
  const { isWeb } = useDevice();

  useEffect(() => {
    setSelectedEquipment(currentEquipment);
    const thermomix = currentEquipment.find(e => e.type === 'thermomix');
    setThermomixModel(thermomix?.model ?? null);
    setShowModelError(false);
  }, [currentEquipment]);

  const hasThermomix = selectedEquipment.some(e => e.type === 'thermomix');

  const toggleEquipment = (type: EquipmentType) => {
    const exists = selectedEquipment.some(e => e.type === type);

    let newEquipment: KitchenEquipment[];
    if (exists) {
      newEquipment = selectedEquipment.filter(e => e.type !== type);
      if (type === 'thermomix') {
        setThermomixModel(null);
        setShowModelError(false);
      }
    } else {
      if (type === 'thermomix') {
        newEquipment = [...selectedEquipment, { type, model: thermomixModel ?? undefined }];
      } else {
        newEquipment = [...selectedEquipment, { type }];
      }
    }

    setSelectedEquipment(newEquipment);
  };

  const selectThermomixModel = (model: ThermomixModel) => {
    setThermomixModel(model);
    setShowModelError(false);

    const newEquipment = selectedEquipment.map(e =>
      e.type === 'thermomix' ? { ...e, model } : e
    );

    setSelectedEquipment(newEquipment);
  };

  const handleSave = () => {
    if (hasThermomix && !thermomixModel) {
      setShowModelError(true);
      return;
    }
    onSave(selectedEquipment);
    onClose();
  };

  const equipmentOrder: EquipmentType[] = ['thermomix', 'air_fryer'];
  const otherEquipment = equipmentOrder.filter(type => type !== 'thermomix');

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
            className={`bg-background-default rounded-lg self-center p-lg shadow-md w-full max-w-[400px] ${isWeb ? 'max-h-[80%] h-auto' : 'h-[90%] rounded-b-none'}`}
          >
            <View className="items-end mb-xs">
              <TouchableOpacity onPress={onClose} className="p-1">
                <Feather name="x" size={24} className="text-text-default" />
              </TouchableOpacity>
            </View>
            <Text preset="h1" className="text-center mb-sm">
              {i18n.t('onboarding.steps.equipment.title')}
            </Text>
            <Text preset="bodySmall" className="text-text-secondary text-center mb-lg">
              {i18n.t('onboarding.steps.equipment.description')}
            </Text>

            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Thermomix (prominent) */}
              <View className="mb-xl">
                <Pressable
                  onPress={() => toggleEquipment('thermomix')}
                  className={`flex-row items-center p-lg rounded-xl border-2 ${
                    hasThermomix
                      ? 'bg-primary-lightest border-primary-medium'
                      : 'bg-background-secondary border-transparent'
                  }`}
                >
                  <Image
                    source={EQUIPMENT_CONFIG.thermomix.icon}
                    style={{ width: 48, height: 48 }}
                    resizeMode="contain"
                    className="mr-md"
                  />
                  <View className="flex-1">
                    <Text preset="subheading">
                      {i18n.t('onboarding.steps.equipment.thermomix.name')}
                    </Text>
                  </View>
                  {hasThermomix && (
                    <Ionicons name="checkmark-circle" size={24} color="#FFBFB7" />
                  )}
                </Pressable>

                {hasThermomix && (
                  <View className="mt-md ml-md">
                    <Text preset="caption" className="mb-sm text-text-secondary">
                      {i18n.t('onboarding.steps.equipment.thermomix.modelQuestion')}
                    </Text>
                    <View className="flex-row gap-md">
                      {EQUIPMENT_CONFIG.thermomix.models.map(model => (
                        <Pressable
                          key={model}
                          onPress={() => selectThermomixModel(model)}
                          className={`px-lg py-md rounded-lg border-2 ${
                            thermomixModel === model
                              ? 'bg-primary-medium border-primary-medium'
                              : showModelError
                                ? 'bg-background-secondary border-status-error'
                                : 'bg-background-secondary border-transparent'
                          }`}
                        >
                          <Text className={`font-semibold ${
                            thermomixModel === model ? 'text-white' : 'text-text-primary'
                          }`}>
                            {model}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    {showModelError && (
                      <Text preset="caption" className="text-status-error mt-sm">
                        {i18n.t('onboarding.steps.equipment.thermomix.modelRequired')}
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Divider */}
              <View className="my-md mx-md">
                <View className="h-[1px] bg-grey-medium opacity-30" />
              </View>

              {/* Other equipment */}
              <View>
                {otherEquipment.map((type, index) => {
                  const config = EQUIPMENT_CONFIG[type];
                  const isSelected = selectedEquipment.some(e => e.type === type);

                  return (
                    <React.Fragment key={type}>
                      <Pressable
                        onPress={() => toggleEquipment(type)}
                        className={`flex-row items-center p-md rounded-lg ${
                          isSelected
                            ? 'bg-primary-lightest'
                            : 'bg-background-secondary'
                        }`}
                      >
                        <Image
                          source={config.icon}
                          style={{ width: 36, height: 36 }}
                          resizeMode="contain"
                          className="mr-md"
                        />
                        <Text className="flex-1">
                          {i18n.t(`onboarding.steps.equipment.${type}.name`)}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color="#FFBFB7" />
                        )}
                      </Pressable>
                      {index < otherEquipment.length - 1 && (
                        <View className="my-md mx-md">
                          <View className="h-[1px] bg-grey-medium opacity-30" />
                        </View>
                      )}
                    </React.Fragment>
                  );
                })}
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
