import { DietType, DietaryRestriction } from "./dietary";

export type Gender = 'male' | 'female' | 'other' | 'preferNotToSay';

export type ActivityLevel = 'sedentary' | 'lightlyActive' | 'moderatelyActive' | 'veryActive' | 'extraActive';

export enum MeasurementSystem {
  METRIC = 'metric',
  IMPERIAL = 'imperial'
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  username: string;
  biography: string | null;
  gender?: Gender;
  birthDate?: string;
  height?: number; // in cm
  weight?: number; // in kg
  activityLevel?: ActivityLevel;
  dietaryRestrictions: DietaryRestriction[];
  dietTypes: DietType[];
  measurementSystem: MeasurementSystem;
  language: string;
  profileImageUrl: string | null;
  onboardingComplete: boolean;
  isAdmin?: boolean;
  createdAt: string;
  updatedAt: string;
  otherAllergy?: string[];
  otherDiet?: string[];
}