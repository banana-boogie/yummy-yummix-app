import React, { useState, useMemo, useEffect } from 'react';
import { View, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';

import i18n from '@/i18n';
import { Button } from '@/components/common';
import { HeaderWithBack } from '@/components/common/HeaderWithBack';
import { HeightInput } from '@/components/form/HeightInput';
import { WeightInput } from '@/components/form/WeightInput';
import { DatePicker } from '@/components/form/DatePicker';
import { SelectInput } from '@/components/form/SelectInput';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useMeasurement } from '@/contexts/MeasurementContext';
import { DietaryRestrictionsModal } from '@/components/profile/DietaryRestrictionsModal';
import { DietModal } from '@/components/profile/DietModal';
import { CuisineModal } from '@/components/profile/CuisineModal';
import { Gender, ActivityLevel } from '@/types/user';
import { DietaryRestriction, DietType, CuisinePreference } from '@/types/dietary';
import { StatusModal } from '@/components/common/StatusModal';
import { PageLayout } from '@/components/layouts/PageLayout';
import { useDevice } from '@/hooks/useDevice';

interface FormData {
  gender: string;
  birthDate: Date;
  height: string;
  weight: string;
  activityLevel: string;
  dietaryRestrictions: DietaryRestriction[];
  dietTypes: DietType[];
  cuisinePreferences: CuisinePreference[];
  otherDiet: string[];
  otherAllergy: string[];
}

export default function PersonalData() {
  const { userProfile, updateUserProfile } = useUserProfile();
  const { measurementSystem } = useMeasurement();

  const { isLarge, isPhone } = useDevice();

  const [showDietaryModal, setShowDietaryModal] = useState(false);
  const [showDietModal, setShowDietModal] = useState(false);
  const [showCuisineModal, setShowCuisineModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);

  const getDefaultDate = useMemo(() => {
    if (userProfile?.birthDate) {
      const date = new Date(userProfile.birthDate);
      // Adjust for timezone offset
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
      return date;
    }
    // Default to 45 years ago (middle of 30-60 range)
    const date = new Date();
    date.setFullYear(date.getFullYear() - 45);
    return date;
  }, [userProfile?.birthDate]);

  const genderOptions = useMemo(() => [
    { label: i18n.t('profile.personalData.genderOptions.male'), value: 'male' as Gender },
    { label: i18n.t('profile.personalData.genderOptions.female'), value: 'female' as Gender },
    { label: i18n.t('profile.personalData.genderOptions.other'), value: 'other' as Gender },
    { label: i18n.t('profile.personalData.genderOptions.preferNotToSay'), value: 'preferNotToSay' as Gender },
  ], []);

  const activityLevelOptions = useMemo(() => [
    { label: i18n.t('profile.personalData.activityLevelOptions.sedentary'), value: 'sedentary' as ActivityLevel },
    { label: i18n.t('profile.personalData.activityLevelOptions.lightlyActive'), value: 'lightlyActive' as ActivityLevel },
    { label: i18n.t('profile.personalData.activityLevelOptions.moderatelyActive'), value: 'moderatelyActive' as ActivityLevel },
    { label: i18n.t('profile.personalData.activityLevelOptions.veryActive'), value: 'veryActive' as ActivityLevel },
    { label: i18n.t('profile.personalData.activityLevelOptions.extraActive'), value: 'extraActive' as ActivityLevel },
  ], []);

  const [formData, setFormData] = useState<FormData>({
    gender: '',
    birthDate: getDefaultDate,
    height: '',
    weight: '',
    activityLevel: '',
    dietaryRestrictions: [],
    dietTypes: [],
    cuisinePreferences: [],
    otherDiet: [],
    otherAllergy: [],
  });

  const [heightError, setHeightError] = useState<string | undefined>();
  const [weightError, setWeightError] = useState<string | undefined>();

  // Update form data when userProfile changes
  useEffect(() => {
    if (userProfile) {
      setFormData({
        gender: userProfile.gender || '',
        birthDate: getDefaultDate,
        height: userProfile.height?.toString() || '',
        weight: userProfile.weight?.toString() || '',
        activityLevel: userProfile.activityLevel || '',
        dietaryRestrictions: userProfile.dietaryRestrictions || [],
        dietTypes: userProfile.dietTypes || [],
        cuisinePreferences: userProfile.cuisinePreferences || [],
        otherDiet: userProfile.otherDiet || [],
        otherAllergy: userProfile.otherAllergy || [],
      });
    }
  }, [userProfile, getDefaultDate]);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasValidationErrors = useMemo(() => {
    return Boolean(heightError || weightError);
  }, [heightError, weightError]);

  const handleSave = async () => {
    try {
      setSaveError(null);
      setIsSaving(true);

      // Adjust the date to handle timezone
      const birthDate = new Date(formData.birthDate);
      birthDate.setMinutes(birthDate.getMinutes() - birthDate.getTimezoneOffset());

      const updatedProfile = {
        gender: formData.gender ? (formData.gender as Gender) : undefined,
        birthDate: birthDate.toISOString().split('T')[0],
        height: formData.height ? parseFloat(formData.height) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        activityLevel: formData.activityLevel ? (formData.activityLevel as ActivityLevel) : undefined,
        dietaryRestrictions: formData.dietaryRestrictions,
        dietTypes: formData.dietTypes,
        otherDiet: formData.otherDiet,
        otherAllergy: formData.otherAllergy,
      };

      await updateUserProfile(updatedProfile);
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setSaveError(i18n.t('common.errors.default'));
      setShowErrorModal(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDietaryUpdate = async (restrictions: DietaryRestriction[], otherAllergies: string[]) => {
    try {
      setIsSaving(true);
      setSaveError(null);

      const updatedProfile = {
        ...formData,
        dietaryRestrictions: restrictions,
        otherAllergy: otherAllergies,
      };

      await updateUserProfile({
        dietaryRestrictions: restrictions,
        otherAllergy: otherAllergies,
      });

      setFormData(updatedProfile);
      setShowDietaryModal(false);
    } catch (error) {
      console.error('Error updating dietary restrictions:', error);
      setSaveError(i18n.t('common.errors.default'));
      setShowErrorModal(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDietUpdate = async (dietTypes: DietType[], otherDiet: string[]) => {
    try {
      setIsSaving(true);
      setSaveError(null);

      const updatedProfile = {
        ...formData,
        dietTypes,
        otherDiet,
      };

      await updateUserProfile({
        dietTypes,
        otherDiet,
      });

      setFormData(updatedProfile);
      setShowDietModal(false);
    } catch (error) {
      console.error('Error updating diet types:', error);
      setSaveError(i18n.t('common.errors.default'));
      setShowErrorModal(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCuisineUpdate = async (cuisinePreferences: CuisinePreference[]) => {
    try {
      setIsSaving(true);
      setSaveError(null);

      const updatedProfile = {
        ...formData,
        cuisinePreferences,
      };

      await updateUserProfile({
        cuisinePreferences,
      });

      setFormData(updatedProfile);
      setShowCuisineModal(false);
    } catch (error) {
      console.error('Error updating cuisine preferences:', error);
      setSaveError(i18n.t('common.errors.default'));
      setShowErrorModal(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageLayout
      header={<HeaderWithBack title={i18n.t('profile.personalData.title')} />}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-xl w-full max-w-[800px] self-center">
            <View className="gap-md">
              <View className="flex-row gap-md flex-wrap justify-center">
                <Button
                  variant="flat"
                  size="medium"
                  label={i18n.t('profile.personalData.dietaryRestrictions')}
                  onPress={() => setShowDietaryModal(true)}
                  className="flex-1 px-sm py-sm min-w-[200px]"
                />
                <Button
                  variant="flat"
                  size="medium"
                  label={i18n.t('profile.personalData.diet')}
                  onPress={() => setShowDietModal(true)}
                  className="flex-1 px-sm py-sm min-w-[200px]"
                />
              </View>
              <Button
                variant="flat"
                size="medium"
                label={i18n.t('profile.personalData.cuisinePreferences')}
                onPress={() => setShowCuisineModal(true)}
                className="px-sm py-sm"
              />
            </View>

            <SelectInput
              label={i18n.t('profile.personalData.gender')}
              value={formData.gender}
              onValueChange={(value: string) => setFormData(prev => ({ ...prev, gender: value }))}
              options={genderOptions}
              placeholder={i18n.t('profile.personalData.gender')}
            />

            <DatePicker
              label={i18n.t('profile.personalData.birthDate')}
              value={formData.birthDate}
              onChange={(date) => setFormData(prev => ({ ...prev, birthDate: date }))}
              maximumDate={new Date()}
            />

            <HeightInput
              label={i18n.t('profile.personalData.height')}
              value={formData.height}
              onChangeValue={(value) => setFormData(prev => ({ ...prev, height: value }))}
              measurementSystem={measurementSystem}
              error={heightError}
              onErrorChange={setHeightError}
            />

            <WeightInput
              label={i18n.t('profile.personalData.weight')}
              value={formData.weight}
              onChangeValue={(value) => setFormData(prev => ({ ...prev, weight: value }))}
              measurementSystem={measurementSystem}
              error={weightError}
              onErrorChange={setWeightError}
            />

            <SelectInput
              label={i18n.t('profile.personalData.activityLevel')}
              value={formData.activityLevel}
              onValueChange={(value: string) => setFormData(prev => ({ ...prev, activityLevel: value }))}
              options={activityLevelOptions}
              placeholder={i18n.t('profile.personalData.activityLevel')}
            />
          </View>

          <Button
            label={i18n.t('common.save')}
            onPress={handleSave}
            className="my-xxl self-center"
            loading={isSaving}
            disabled={isSaving || hasValidationErrors}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <DietaryRestrictionsModal
        visible={showDietaryModal}
        onClose={() => setShowDietaryModal(false)}
        currentRestrictions={formData.dietaryRestrictions}
        currentOtherAllergies={formData.otherAllergy}
        onSave={handleDietaryUpdate}
        title={i18n.t('profile.personalData.allergies')}
      />

      <DietModal
        visible={showDietModal}
        onClose={() => setShowDietModal(false)}
        currentDietTypes={formData.dietTypes}
        currentOtherDiet={formData.otherDiet}
        onSave={handleDietUpdate}
      />

      <CuisineModal
        visible={showCuisineModal}
        onClose={() => setShowCuisineModal(false)}
        currentCuisines={formData.cuisinePreferences}
        onSave={handleCuisineUpdate}
      />

      <StatusModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        type="success"
        message={i18n.t('common.saved')}
      />

      <StatusModal
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        type="error"
        message={saveError || i18n.t('common.errors.default')}
        showCloseButton
      />
    </PageLayout>
  );
}