import { DietaryRestriction, DietType } from './dietary';

export interface OnboardingData {
  name: string;
  dietaryRestrictions: DietaryRestriction[];
  dietTypes: DietType[];
  otherAllergy?: string[];
  otherDiet?: string[];
  language?: string;
  measurementSystem?: 'metric' | 'imperial';
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