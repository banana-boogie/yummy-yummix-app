import React, { useState, useEffect } from 'react';
import { View, ScrollView, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

import i18n from '@/i18n';
import { Text } from '@/components/common/Text';
import { TextInput } from '@/components/form/TextInput';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useProfileImage } from '@/hooks/useProfileImage';
import ImageUpload from '@/components/profile/ImageUpload';
import { Button } from '@/components/common/Button';
import { DangerButton } from '@/components/common/DangerButton';
import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import { useDevice } from '@/hooks/useDevice';
import { PageLayout } from '@/components/layouts/PageLayout';
import { HeaderWithBack } from '@/components/common/HeaderWithBack';
import { COLORS, FONT_SIZES } from '@/constants/design-tokens';

const BIO_MAX_LENGTH = 140; // Reduced to match mockup
const NAME_MAX_LENGTH = 30;

export default function EditProfile() {
  const { userProfile, updateUserProfile } = useUserProfile();
  const { deleteProfileImage } = useProfileImage();
  const { isLarge } = useDevice();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [bioLength, setBioLength] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '');
      setBio(userProfile.biography || '');
      setBioLength(userProfile.biography?.length || 0);
      setIsLoading(false);
    }
  }, [userProfile]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      await updateUserProfile({
        name,
        biography: bio,
      });
      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
        router.back();
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
      // Only keep first 4 lines
      text = lines.slice(0, 4).join('\n');
    }
    if (text.length <= BIO_MAX_LENGTH) {
      setBio(text);
      setBioLength(text.length);
    }
  };

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

  const content = (
    <>
      <Button
        variant="flat"
        label={i18n.t('profile.configurePersonalData')}
        onPress={() => router.push('/(tabs)/profile/personal-data')}
        className="flex-row items-center rounded-md mb-xl py-md mt-md"
        icon={require('@/assets/images/user-profile/edit-icon.png')}
        iconClassName="mr-sm"
      />

      <View className="gap-xl px-sm">
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

      <Button
        label={i18n.t('common.save')}
        onPress={handleSave}
        className="mt-xl mb-xl py-md"
        textClassName="text-base"
        loading={isSaving}
        disabled={isSaving}
      />

      <DangerButton
        className="pb-md"
        textClassName="text-base"
        label={i18n.t('profile.deleteAccount')}
        onPress={() => setShowDeleteModal(true)}
      />
    </>
  );
  return (
    <PageLayout scrollEnabled={true} contentPaddingHorizontal={0} disableMaxWidth={true}>
      {header}
      <View className="w-full max-w-[800px] self-center px-md">
        {content}
      </View>

      <DeleteAccountModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      />

      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-background-default rounded-lg p-lg items-center gap-sm min-w-[300px]">
            <Text preset="h1" className="text-center">✓</Text>
            <Text preset="body" className="text-center">
              {i18n.t('common.saved')}
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showErrorModal}
        transparent={true}
        animationType="fade"
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-background-default rounded-lg p-lg items-center gap-sm min-w-[300px]">
            <Text preset="h1" className="text-center text-status-error">!</Text>
            <Text preset="body" className="text-center text-status-error">
              {saveError}
            </Text>
            <Button
              label={i18n.t('common.back')}
              onPress={() => setShowErrorModal(false)}
              variant="secondary"
              size={isLarge ? "medium" : "small"}
              className="mt-md"
            />
          </View>
        </View>
      </Modal>
    </PageLayout>
  );
}