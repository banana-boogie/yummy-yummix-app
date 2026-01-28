import { DietaryRestriction, DietType } from './dietary';
import type { EquipmentType, ThermomixModel } from '@/constants/equipment';

export interface KitchenEquipment {
  type: EquipmentType;
  model?: ThermomixModel; // Only for Thermomix
}

export interface OnboardingData {
  name: string;
  dietaryRestrictions: DietaryRestriction[];
  dietTypes: DietType[];
  otherAllergy?: string[];
  otherDiet?: string[];
  language?: string;
  measurementSystem?: 'metric' | 'imperial';
  kitchenEquipment?: KitchenEquipment[];
}

export interface OnboardingState {
  currentStep: number;
  formData: Partial<OnboardingData>;
}

export interface UserProfile {
  name: string;
  dietaryRestrictions: DietaryRestriction[];
  dietTypes: DietType[];
  onboardingComplete: boolean;
  otherAllergy?: string[];
  otherDiet?: string[];
} 