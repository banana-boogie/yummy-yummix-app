import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';

import i18n from '@/i18n';
import { Text } from '@/components/common/Text';
import { TextInput } from '@/components/form/TextInput';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useMeasurement } from '@/contexts/MeasurementContext';
import { useProfileImage } from '@/hooks/useProfileImage';

import ImageUpload from '@/components/profile/ImageUpload';
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
import { normalizeDietAndCuisinePreferences } from '@/utils/preferencesNormalization';
import { EquipmentModal } from '@/components/profile/EquipmentModal';
import { parseEquipmentString, formatEquipmentForStorage } from '@/constants/equipment';
import type { KitchenEquipment } from '@/types/onboarding';
import logger from '@/services/logger';

const BIO_MAX_LENGTH = 140;
const NAME_MAX_LENGTH = 30;
const AUTOSAVE_DELAY_MS = 1500;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savedIndicatorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(true);

  // Modal state
  const [showDietaryModal, setShowDietaryModal] = useState(false);
  const [showDietModal, setShowDietModal] = useState(false);
  const [showCuisineModal, setShowCuisineModal] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);

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
      const normalizedPreferences = normalizeDietAndCuisinePreferences(
        userProfile.dietTypes || [],
        userProfile.cuisinePreferences || []
      );

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
        dietTypes: normalizedPreferences.dietTypes,
        cuisinePreferences: normalizedPreferences.cuisinePreferences,
        otherDiet: userProfile.otherDiet || [],
        otherAllergy: userProfile.otherAllergy || [],
      });
      setIsLoading(false);
      // Mark initial load complete after a tick so the first useEffect doesn't trigger auto-save
      setTimeout(() => { initialLoadRef.current = false; }, 0);
    }
  }, [userProfile, getDefaultDate]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
    };
  }, []);

  // --- Auto-save logic ---

  const performSave = useCallback(async (
    currentName: string,
    currentBio: string,
    currentFormData: FormData,
  ) => {
    if (hasValidationErrors) return;
    try {
      setSaveStatus('saving');
      setSaveError(null);
      const normalizedPreferences = normalizeDietAndCuisinePreferences(
        currentFormData.dietTypes,
        currentFormData.cuisinePreferences
      );

      const birthDate = new Date(currentFormData.birthDate);
      birthDate.setMinutes(birthDate.getMinutes() - birthDate.getTimezoneOffset());

      await updateUserProfile({
        name: currentName,
        biography: currentBio,
        gender: currentFormData.gender ? (currentFormData.gender as Gender) : undefined,
        birthDate: birthDate.toISOString().split('T')[0],
        height: currentFormData.height ? parseFloat(currentFormData.height) : undefined,
        weight: currentFormData.weight ? parseFloat(currentFormData.weight) : undefined,
        activityLevel: currentFormData.activityLevel ? (currentFormData.activityLevel as ActivityLevel) : undefined,
        dietaryRestrictions: currentFormData.dietaryRestrictions,
        dietTypes: normalizedPreferences.dietTypes,
        cuisinePreferences: normalizedPreferences.cuisinePreferences,
        otherDiet: currentFormData.otherDiet,
        otherAllergy: currentFormData.otherAllergy,
      });
      setSaveStatus('saved');
      if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
      savedIndicatorTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      logger.error('Error auto-saving profile:', error);
      setSaveStatus('error');
      setSaveError(i18n.t('common.errors.default'));
      setShowErrorModal(true);
    }
  }, [updateUserProfile, hasValidationErrors]);

  // Debounced auto-save for text fields (name, bio)
  const scheduleDebouncedSave = useCallback(() => {
    if (initialLoadRef.current || isLoading) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      performSave(name, bio, formData);
    }, AUTOSAVE_DELAY_MS);
  }, [name, bio, formData, performSave, isLoading]);

  // Trigger debounced save when name or bio changes
  useEffect(() => {
    scheduleDebouncedSave();
  }, [name, bio]); // eslint-disable-line react-hooks/exhaustive-deps

  // Immediate save when select/picker fields change
  const handleFormDataChange = useCallback((updater: (prev: FormData) => FormData) => {
    setFormData(prev => {
      const next = updater(prev);
      // Schedule immediate save with updated formData
      if (!initialLoadRef.current) {
        // Cancel any pending debounced save
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        // Use setTimeout(0) to ensure state has settled
        setTimeout(() => performSave(name, bio, next), 0);
      }
      return next;
    });
  }, [name, bio, performSave]);

  // --- Handlers ---

  const handleImageUpload = async (url: string) => {
    try {
      if (userProfile?.profileImageUrl) {
        await deleteProfileImage(userProfile.profileImageUrl);
      }
      await updateUserProfile({ profileImageUrl: url });
    } catch (error) {
      logger.error('Error uploading image:', error);
      setSaveError(i18n.t('common.errors.default'));
      setShowErrorModal(true);
    }
  };

  const handleImageDelete = async () => {
    try {
      if (userProfile?.profileImageUrl) {
        await deleteProfileImage(userProfile.profileImageUrl);
        await updateUserProfile({ profileImageUrl: null });
      }
    } catch (error) {
      logger.error('Error deleting image:', error);
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

  const handlePreferenceUpdate = async (
    updates: Parameters<typeof updateUserProfile>[0],
    formUpdates: Partial<typeof formData>,
    closeModal: () => void,
  ) => {
    try {
      setSaveStatus('saving');
      setSaveError(null);
      await updateUserProfile(updates);
      setFormData(prev => ({ ...prev, ...formUpdates }));
      closeModal();
      setSaveStatus('saved');
      if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
      savedIndicatorTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      logger.error('Error updating preferences:', error);
      setSaveStatus('error');
      setSaveError(i18n.t('common.errors.default'));
      setShowErrorModal(true);
    }
  };

  const handleDietaryUpdate = (restrictions: DietaryRestriction[], otherAllergies: string[]) =>
    handlePreferenceUpdate(
      { dietaryRestrictions: restrictions, otherAllergy: otherAllergies },
      { dietaryRestrictions: restrictions, otherAllergy: otherAllergies },
      () => setShowDietaryModal(false),
    );

  const handleDietUpdate = (dietTypes: DietType[], otherDiet: string[]) =>
    {
      const normalizedPreferences = normalizeDietAndCuisinePreferences(
        dietTypes,
        formData.cuisinePreferences
      );
      return handlePreferenceUpdate(
        {
          dietTypes: normalizedPreferences.dietTypes,
          cuisinePreferences: normalizedPreferences.cuisinePreferences,
          otherDiet
        },
        {
          dietTypes: normalizedPreferences.dietTypes,
          cuisinePreferences: normalizedPreferences.cuisinePreferences,
          otherDiet
        },
        () => setShowDietModal(false),
      );
    };

  const handleCuisineUpdate = (cuisinePreferences: CuisinePreference[]) =>
    handlePreferenceUpdate(
      { cuisinePreferences },
      { cuisinePreferences },
      () => setShowCuisineModal(false),
    );

  const handleEquipmentUpdate = async (equipment: KitchenEquipment[]) => {
    try {
      setSaveStatus('saving');
      setSaveError(null);
      const formattedEquipment = [...new Set(
        equipment.map(eq => formatEquipmentForStorage(eq.type, eq.model))
      )];
      await updateUserProfile({
        kitchen_equipment: formattedEquipment,
      } as any);
      setShowEquipmentModal(false);
      setSaveStatus('saved');
      if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
      savedIndicatorTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      logger.error('Error updating equipment:', error);
      setSaveStatus('error');
      setSaveError(i18n.t('common.errors.default'));
      setShowErrorModal(true);
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

  // Parse stored equipment strings back to KitchenEquipment[]
  const currentEquipment: KitchenEquipment[] = useMemo(() =>
    (userProfile?.kitchenEquipment ?? []).map(parseEquipmentString),
    [userProfile?.kitchenEquipment]
  );

  const equipmentDisplayNames = currentEquipment.map(eq => {
    const name = i18n.t(`onboarding.steps.equipment.${eq.type}.name`);
    return eq.model ? `${name} (${eq.model})` : name;
  });

  // --- Save status indicator ---

  const saveStatusLabel = saveStatus === 'saving'
    ? i18n.t('common.saving')
    : saveStatus === 'saved'
      ? i18n.t('common.saved')
      : null;

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
              <PreferenceSummary
                label={i18n.t('profile.summaries.equipment')}
                selected={equipmentDisplayNames}
                onEdit={() => setShowEquipmentModal(true)}
                emptyText={i18n.t('profile.summaries.noEquipment')}
              />
            </View>
          </FormSection>

          {/* Section 3: Health & Activity */}
          <FormSection title={i18n.t('profile.sections.healthActivity')}>
            <View className="gap-xl">
              <SelectInput
                label={i18n.t('profile.personalData.gender')}
                value={formData.gender}
                onValueChange={(value: string) => handleFormDataChange(prev => ({ ...prev, gender: value }))}
                options={genderOptions}
                placeholder={i18n.t('profile.personalData.gender')}
              />

              <DatePicker
                label={i18n.t('profile.personalData.birthDate')}
                value={formData.birthDate}
                onChange={(date) => handleFormDataChange(prev => ({ ...prev, birthDate: date }))}
                maximumDate={new Date()}
              />

              <HeightInput
                label={i18n.t('profile.personalData.height')}
                value={formData.height}
                onChangeValue={(value) => handleFormDataChange(prev => ({ ...prev, height: value }))}
                measurementSystem={measurementSystem}
                error={heightError}
                onErrorChange={setHeightError}
              />

              <WeightInput
                label={i18n.t('profile.personalData.weight')}
                value={formData.weight}
                onChangeValue={(value) => handleFormDataChange(prev => ({ ...prev, weight: value }))}
                measurementSystem={measurementSystem}
                error={weightError}
                onErrorChange={setWeightError}
              />

              <SelectInput
                label={i18n.t('profile.personalData.activityLevel')}
                value={formData.activityLevel}
                onValueChange={(value: string) => handleFormDataChange(prev => ({ ...prev, activityLevel: value }))}
                options={activityLevelOptions}
                placeholder={i18n.t('profile.personalData.activityLevel')}
              />
            </View>
          </FormSection>

          {/* Auto-save status indicator */}
          {saveStatusLabel && (
            <View className="items-center pb-lg">
              <Text preset="caption" className="text-text-secondary">
                {saveStatusLabel}
              </Text>
            </View>
          )}
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

      <EquipmentModal
        visible={showEquipmentModal}
        onClose={() => setShowEquipmentModal(false)}
        currentEquipment={currentEquipment}
        onSave={handleEquipmentUpdate}
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
