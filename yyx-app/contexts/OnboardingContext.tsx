import React, { createContext, useContext, useState, useEffect } from 'react';
import { OnboardingData } from '@/types/onboarding';
import { Storage } from '@/utils/storage';

const ONBOARDING_STORAGE_KEY = 'onboarding_state';

export interface OnboardingContextType {
  currentStep: number;
  formData: OnboardingData;
  updateFormData: (data: Partial<OnboardingData>) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  setCurrentStep: (step: number) => void;
  totalSteps: number;
  resetOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<OnboardingData>({} as OnboardingData);
  const totalSteps = 5;

  // Load saved state on mount
  useEffect(() => {
    loadSavedState();
  }, []);

  // Save state changes
  useEffect(() => {
    saveState();
  }, [currentStep, formData]);

  const loadSavedState = async () => {
    try {
      const savedState = await Storage.getItem(ONBOARDING_STORAGE_KEY);
      if (savedState) {
        const { step, data } = JSON.parse(savedState);
        setCurrentStep(step);
        setFormData(data);
      }
    } catch (error) {
      console.error('Failed to load onboarding state:', error);
    }
  };

  const saveState = async () => {
    try {
      await Storage.setItem(
        ONBOARDING_STORAGE_KEY,
        JSON.stringify({
          step: currentStep,
          data: formData,
        })
      );
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
  };

  const updateFormData = (newData: Partial<OnboardingData>) => {
    setFormData(prev => ({ ...prev, ...newData }));
  };

  const resetOnboarding = async () => {
    setCurrentStep(0);
    setFormData({} as OnboardingData);
    try {
      await Storage.removeItem(ONBOARDING_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to reset onboarding state:', error);
    }
  };

  const goToNextStep = () => {
    setCurrentStep((prev) => Math.min(totalSteps - 1, prev + 1));
  };

  const goToPreviousStep = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  return (
    <OnboardingContext.Provider 
      value={{ 
        currentStep, 
        formData, 
        setCurrentStep, 
        updateFormData,
        totalSteps,
        resetOnboarding,
        goToNextStep,
        goToPreviousStep
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
} 