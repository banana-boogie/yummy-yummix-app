import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, View, Platform, KeyboardAvoidingView } from 'react-native';
import { Image } from 'expo-image';

import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { OnboardingData, OnboardingData as OnboardingDataContext } from '@/types/onboarding';
import { GRADIENT } from '@/constants';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { Language, useLanguage } from '@/contexts/LanguageContext';
import { useMeasurement } from '@/contexts/MeasurementContext';
import { MeasurementSystem } from '@/types/user';

import { WelcomeStep } from './steps/WelcomeStep';
import { NameStep } from './steps/NameStep';
import { AllergiesStep } from './steps/AllergiesStep';
import { EquipmentStep } from './steps/EquipmentStep';
import { formatEquipmentForStorage } from '@/constants/equipment';
import { DietStep } from './steps/DietStep';
import { AppPreferencesStep } from './steps/AppPreferencesStep';
import { useDevice } from '@/hooks/useDevice';

interface OnboardingModalProps {
  visible: boolean;
}

export function OnboardingModal({ visible }: OnboardingModalProps) {
  const { signOut } = useAuth();
  const { updateUserProfile } = useUserProfile();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setLanguage } = useLanguage();
  const { setMeasurementSystem } = useMeasurement();
  const { isWeb, isPhone } = useDevice();

  const handleComplete = async (formData: OnboardingDataContext) => {
    try {
      setIsSubmitting(true);

      // Update language and measurement system
      if (formData.language) {
        await setLanguage(formData.language as Language);
      }
      if (formData.measurementSystem) {
        await setMeasurementSystem(formData.measurementSystem as MeasurementSystem);
      }

      // Format kitchen equipment for storage
      const formattedEquipment = formData.kitchenEquipment?.map(eq =>
        formatEquipmentForStorage(eq.type, eq.model)
      ) ?? [];

      // Remove kitchenEquipment from formData to avoid duplicates (it will be added as kitchen_equipment)
      const { kitchenEquipment, ...restFormData } = formData;

      const profileUpdate = {
        ...restFormData,
        onboardingComplete: true,
        measurementSystem: formData.measurementSystem as MeasurementSystem,
        kitchen_equipment: formattedEquipment, // Use snake_case for database column
      };

      await updateUserProfile(profileUpdate);

      router.replace('/');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);

      // Handle stale session (profile doesn't exist for current user)
      if (error instanceof Error && error.message === 'PROFILE_NOT_FOUND') {
        console.warn('Stale session detected - signing out and redirecting to login');
        await signOut();
        router.replace('/auth/login');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Shared header component
  const ModalHeader = () => (
    <LinearGradient
      colors={GRADIENT.PRIMARY_TO_WHITE}
      locations={[0, 0.2, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      className={`mb-md ${Platform.OS === 'web' ? 'min-h-[90px]' : 'min-h-[80px]'}`}
    >
      <View className="flex-row justify-end items-end flex-1">
        <View className="relative">
          <Image
            source={require('@/assets/images/yyx_logo_header_with_banner.png')}
            className={`absolute right-0 bottom-[-5px] w-[100px] ${isPhone ? 'h-[150px]' : 'h-[140px]'}`}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </View>
      </View>
    </LinearGradient>
  );

  // Web-specific renderer
  if (isWeb) {
    return (
      <View className="absolute inset-0 bg-black/50 z-[1000] justify-center items-center p-lg">
        <View className="w-full max-w-[700px] h-[800px] flex items-center">
          <View className="bg-background-default rounded-md overflow-hidden w-full flex-1 flex-col shadow-lg">
            <ModalHeader />
            <View className="flex-1 w-full self-center max-w-[390px] md:max-w-[550px] lg:max-w-[700px] mt-xl">
              <StepRenderer
                onComplete={handleComplete}
                isSubmitting={isSubmitting}
              />
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Mobile-specific renderer
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View className="flex-1 bg-background-default">
        <ModalHeader />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 w-full self-center max-w-[390px] md:max-w-[550px] lg:max-w-[700px] mt-xl"
        >
          <StepRenderer
            onComplete={handleComplete}
            isSubmitting={isSubmitting}
          />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function StepRenderer({ onComplete, isSubmitting }: { onComplete: (data: OnboardingData) => Promise<void>, isSubmitting: boolean }) {
  const { currentStep } = useOnboarding();

  switch (currentStep) {
    case 0:
      return <WelcomeStep />;
    case 1:
      return <NameStep />;
    case 2:
      return <AppPreferencesStep />;
    case 3:
      return <EquipmentStep />;
    case 4:
      return <AllergiesStep />;
    case 5:
      return <DietStep onComplete={onComplete} isSubmitting={isSubmitting} />;
    default:
      return null;
  }
}