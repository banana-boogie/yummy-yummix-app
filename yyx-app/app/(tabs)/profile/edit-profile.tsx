import React, { useState, useMemo, useEffect } from 'react';
import { View, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';

import i18n from '@/i18n';
import { TextInput } from '@/components/form/TextInput';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useMeasurement } from '@/contexts/MeasurementContext';
import { useProfileImage } from '@/hooks/useProfileImage';

import ImageUpload from '@/components/profile/ImageUpload';
import { Button } from '@/components/common/Button';
import { DietaryRestrictionsModal } from '@/components/profile/DietaryRestrictionsModal';
import { DietModal } from '@/components/profile/DietModal';
import { CuisineModal } from '@/components/profile/CuisineModal';
import { PreferenceSummary } from '@/components/profile/PreferenceSummary';
import { FormSection } from '@/components/form/FormSection';
import { HeightInput } from '@/components/form/HeightInput';
import { WeightInput } from '@/components/form/WeightInput';
import { DatePicker } from '@/components/form/DatePicker';
import { SelectInput } from '@/components/form/SelectInput';
import { StatusModal } from '@/components/common/StatusModal';
import { PageLayout } from '@/components/layouts/PageLayout';
import { HeaderWithBack } from '@/components/common/HeaderWithBack';
import { Gender, ActivityLevel } from '@/types/user';
import { DietaryRestriction, DietType, CuisinePreference } from '@/types/dietary';
import { COLORS } from '@/constants/design-tokens';

const BIO_MAX_LENGTH = 140;
const NAME_MAX_LENGTH = 30;

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

export default function EditProfile() {
  const { userProfile, updateUserProfile } = useUserProfile();
  const { deleteProfileImage } = useProfileImage();
  const { measurementSystem } = useMeasurement();

  // Basic profile state
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [bioLength, setBioLength] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Save/error state
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);

  // Modal state
  const [showDietaryModal, setShowDietaryModal] = useState(false);
  const [showDietModal, setShowDietModal] = useState(false);
  const [showCuisineModal, setShowCuisineModal] = useState(false);

  // Validation state
  const [heightError, setHeightError] = useState<string | undefined>();
  const [weightError, setWeightError] = useState<string | undefined>();

  const getDefaultDate = useMemo(() => {
    if (userProfile?.birthDate) {
      const date = new Date(userProfile.birthDate);
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
      return date;
    }
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

  // Personal data form state
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

  const hasValidationErrors = useMemo(() => {
    return Boolean(heightError || weightError);
  }, [heightError, weightError]);

  // Load user profile into form state
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '');
      setBio(userProfile.biography || '');
      setBioLength(userProfile.biography?.length || 0);
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
      setIsLoading(false);
    }
  }, [userProfile, getDefaultDate]);

  // --- Handlers ---

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);

      const birthDate = new Date(formData.birthDate);
      birthDate.setMinutes(birthDate.getMinutes() - birthDate.getTimezoneOffset());

      await updateUserProfile({
        name,
        biography: bio,
        gender: formData.gender ? (formData.gender as Gender) : undefined,
        birthDate: birthDate.toISOString().split('T')[0],
        height: formData.height ? parseFloat(formData.height) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        activityLevel: formData.activityLevel ? (formData.activityLevel as ActivityLevel) : undefined,
        dietaryRestrictions: formData.dietaryRestrictions,
        dietTypes: formData.dietTypes,
        otherDiet: formData.otherDiet,
        otherAllergy: formData.otherAllergy,
      });
      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 2000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setSaveError(i18n.t('common.errors.default'));
      setShowErrorModal(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (url: string) => {
    if (userProfile?.profileImageUrl) {
      await deleteProfileImage(userProfile.profileImageUrl);
    }
    await updateUserProfile({ profileImageUrl: url });
  };

  const handleImageDelete = async () => {
    try {
      if (userProfile?.profileImageUrl) {
        await deleteProfileImage(userProfile.profileImageUrl);
        await updateUserProfile({ profileImageUrl: null });
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  };

  const handleBioChange = (text: string) => {
    const lines = text.split('\n');
    if (lines.length > 4) {
      text = lines.slice(0, 4).join('\n');
    }
    if (text.length <= BIO_MAX_LENGTH) {
      setBio(text);
      setBioLength(text.length);
    }
  };

  const handleDietaryUpdate = async (restrictions: DietaryRestriction[], otherAllergies: string[]) => {
    try {
      setIsSaving(true);
      setSaveError(null);
      await updateUserProfile({
        dietaryRestrictions: restrictions,
        otherAllergy: otherAllergies,
      });
      setFormData(prev => ({
        ...prev,
        dietaryRestrictions: restrictions,
        otherAllergy: otherAllergies,
      }));
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
      await updateUserProfile({
        dietTypes,
        otherDiet,
      });
      setFormData(prev => ({
        ...prev,
        dietTypes,
        otherDiet,
      }));
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
      await updateUserProfile({
        cuisinePreferences,
      });
      setFormData(prev => ({
        ...prev,
        cuisinePreferences,
      }));
      setShowCuisineModal(false);
    } catch (error) {
      console.error('Error updating cuisine preferences:', error);
      setSaveError(i18n.t('common.errors.default'));
      setShowErrorModal(true);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Display name mappers ---

  const dietDisplayNames = formData.dietTypes
    .filter(slug => slug !== 'none')
    .map(slug => i18n.t(`onboarding.steps.diet.options.${slug}`));

  const allergyDisplayNames = formData.dietaryRestrictions
    .filter(slug => slug !== 'none')
    .map(slug => i18n.t(`onboarding.steps.allergies.options.${slug}`));

  const cuisineDisplayNames = formData.cuisinePreferences.map(
    slug => i18n.t(`onboarding.steps.cuisines.options.${slug}`)
  );

  // --- Render ---

  const header = (
    <HeaderWithBack title={i18n.t('profile.editProfile')}>
      {isLoading ? (
        <View className="flex-1 justify-center items-center min-h-[100px]">
          <ActivityIndicator size="large" color={COLORS.grey.dark} />
        </View>
      ) : (
        <ImageUpload
          url={userProfile?.profileImageUrl}
          fileName={`${userProfile?.id}_${Date.now()}`}
          showDeleteButton={true}
          onUpload={handleImageUpload}
          onDelete={handleImageDelete}
          className="items-center mb-xl"
          buttonClassName="w-[150px] h-[150px]"
          caption={i18n.t('profile.changePhoto')}
        />
      )}
    </HeaderWithBack>
  );

  return (
    <PageLayout scrollEnabled={true} contentPaddingHorizontal={0} disableMaxWidth={true}>
      {header}

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="w-full max-w-[800px] self-center px-md gap-xl pb-xl">
          {/* Section 1: About You */}
          <FormSection title={i18n.t('profile.sections.aboutYou')}>
            <View className="gap-xl">
              <TextInput
                label={i18n.t('profile.name')}
                value={name}
                onChangeText={setName}
                maxLength={NAME_MAX_LENGTH}
                helperText={`${name.length}/${NAME_MAX_LENGTH}`}
                className="text-base h-[56px]"
              />
              <TextInput
                label={i18n.t('profile.bio')}
                value={bio}
                onChangeText={handleBioChange}
                multiline
                textAlignVertical="top"
                numberOfLines={4}
                maxLength={BIO_MAX_LENGTH}
                className="h-[120px] lg:h-[150px] pt-sm text-base"
                helperText={`${bioLength}/${BIO_MAX_LENGTH}`}
                scrollEnabled={false}
              />
            </View>
          </FormSection>

          {/* Section 2: Your Kitchen Profile */}
          <FormSection title={i18n.t('profile.sections.kitchenProfile')}>
            <View className="gap-lg">
              <PreferenceSummary
                label={i18n.t('profile.summaries.diet')}
                selected={dietDisplayNames}
                onEdit={() => setShowDietModal(true)}
                emptyText={i18n.t('profile.summaries.noDiet')}
              />
              <PreferenceSummary
                label={i18n.t('profile.summaries.allergies')}
                selected={allergyDisplayNames}
                onEdit={() => setShowDietaryModal(true)}
                emptyText={i18n.t('profile.summaries.noAllergies')}
              />
              <PreferenceSummary
                label={i18n.t('profile.summaries.cuisine')}
                selected={cuisineDisplayNames}
                onEdit={() => setShowCuisineModal(true)}
                emptyText={i18n.t('profile.summaries.noCuisine')}
              />
            </View>
          </FormSection>

          {/* Section 3: Health & Activity */}
          <FormSection title={i18n.t('profile.sections.healthActivity')}>
            <View className="gap-xl">
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
          </FormSection>

          {/* Save Button */}
          <View className="mt-lg mb-xl">
            <Button
              label={i18n.t('common.save')}
              onPress={handleSave}
              className="py-md"
              textClassName="text-base"
              loading={isSaving}
              disabled={isSaving || hasValidationErrors}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Modals */}
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
