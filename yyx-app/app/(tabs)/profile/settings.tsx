import React, { useState } from 'react';
import { View } from 'react-native';
import i18n from '@/i18n';
import { Language, useLanguage } from '@/contexts/LanguageContext';
import { useMeasurement } from '@/contexts/MeasurementContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { MeasurementSystem } from '@/types/user';
import { SystemButtons } from '@/components/settings/SystemButtons';
import { DangerButton } from '@/components/common/DangerButton';
import { StatusModal } from '@/components/common/StatusModal';
import { HeaderWithBack } from '@/components/common/HeaderWithBack';
import { PageLayout } from '@/components/layouts/PageLayout';

export default function Settings() {
  const { language, setLanguage } = useLanguage();
  const { measurementSystem, setMeasurementSystem } = useMeasurement();
  const { signOut } = useAuth();
  const { updateUserProfile } = useUserProfile();

  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const handleLanguageChange = async (newLanguage: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Update user profile first
      await updateUserProfile({
        language: newLanguage
      });

      // Then update language in context - this will trigger the app restart dialog
      await setLanguage(newLanguage as Language);

      setIsLoading(false);
    } catch (error) {
      console.error('Error changing language:', error);
      setError(i18n.t('common.errors.default'));
      setShowErrorModal(true);
      setIsLoading(false);
    }
  };

  const handleMeasurementChange = async (newSystem: MeasurementSystem) => {
    try {
      setIsLoading(true);
      setError(null);

      // Update measurement system in context
      await setMeasurementSystem(newSystem);

      // Persist to user profile
      await updateUserProfile({
        measurementSystem: newSystem
      });

      setSuccessMessage(i18n.t('common.saved'));
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
    } catch (error) {
      console.error('Error changing measurement system:', error);
      setError(i18n.t('common.errors.default'));
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await signOut();

    } catch (error) {
      console.error('Error signing out:', error);
      setError(typeof error === 'object' && error !== null && 'message' in error
        ? (error as Error).message
        : i18n.t('common.errors.default'));
      setShowErrorModal(true);
      setIsLoading(false);
    }
  };

  return (
    <PageLayout header={<HeaderWithBack title={i18n.t('settings.title')} />}>
      <SystemButtons
        language={language}
        onLanguageChange={handleLanguageChange}
        measurementSystem={measurementSystem}
        onMeasurementChange={handleMeasurementChange}
      />

      <View className="flex-1 justify-end pb-lg gap-lg">
        <DangerButton
          label={i18n.t('settings.signOut')}
          onPress={handleSignOut}
          disabled={isLoading}
        />
      </View>

      <StatusModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        type="success"
        message={successMessage}
      />

      <StatusModal
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        type="error"
        message={error || i18n.t('common.errors.default')}
        showCloseButton
      />
    </PageLayout>
  );
}