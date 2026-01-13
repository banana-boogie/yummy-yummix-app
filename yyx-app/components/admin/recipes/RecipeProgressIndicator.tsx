import React from 'react';
import { View, Pressable } from 'react-native';
import i18n from '@/i18n';
import { Text } from '@/components/common/Text';

export enum CreateRecipeStep {
  INITIAL_SETUP = 0,
  BASIC_INFO = 1,
  USEFUL_ITEMS = 2,
  INGREDIENTS = 3,
  STEPS = 4,
  TAGS = 5,
  REVIEW = 6,
}

interface RecipeProgressIndicatorProps {
  currentStep: CreateRecipeStep;
  onStepClick?: (step: CreateRecipeStep) => void;
  clickable?: boolean;
}

export function RecipeProgressIndicator({
  currentStep,
  onStepClick,
  clickable = false
}: RecipeProgressIndicatorProps) {

  const steps = [
    i18n.t('admin.recipes.form.basicInfo.title'),
    i18n.t('admin.recipes.form.usefulItemsInfo.title'),
    i18n.t('admin.recipes.form.ingredientsInfo.title'),
    i18n.t('admin.recipes.form.stepsInfo.title'),
    i18n.t('admin.recipes.form.tagsInfo.title'),
    i18n.t('admin.recipes.form.reviewInfo.title'),
  ];

  const handleStepPress = (index: number) => {
    if (clickable && onStepClick) {
      onStepClick(index + 1 as CreateRecipeStep);
    }
  };

  return (
    <View className="flex-row justify-between items-center flex-wrap mt-xs mb-md mx-md">
      {steps.map((step, index) => {
        const isActive = currentStep > index;
        return (
          <React.Fragment key={index}>
            {index > 0 && <View style={{ width: 30, height: 1, backgroundColor: '#e5e7eb', marginHorizontal: 4 }} />}
            <Pressable
              onPress={() => handleStepPress(index)}
              style={{ alignItems: 'center', marginTop: 4, opacity: isActive ? 1 : 0.6 }}
            >
              <View
                className={`w-[30px] h-[30px] rounded-full justify-center items-center mb-1 ${isActive ? 'bg-[#f5a9a9]' : 'bg-[#f3f4f6]'}`}
              >
                <Text style={{ textAlign: 'center', color: isActive ? '#fff' : '#374151' }}>
                  {index + 1}
                </Text>
              </View>
              <Text style={{ fontSize: 12, textAlign: 'center', color: isActive ? '#111827' : '#6b7280', fontWeight: isActive ? 'bold' : 'normal' }}>
                {step}
              </Text>
            </Pressable>
          </React.Fragment>
        );
      })}
    </View >
  );
}
