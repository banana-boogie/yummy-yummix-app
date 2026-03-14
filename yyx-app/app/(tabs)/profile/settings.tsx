import React, { useState } from 'react';
import { View } from 'react-native';
import { getLocales } from 'expo-localization';
import i18n from '@/i18n';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMeasurement } from '@/contexts/MeasurementContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { MeasurementSystem } from '@/types/user';
import { useActiveLocales } from '@/hooks/admin/useActiveLocales';
import { SystemButtons } from '@/components/settings/SystemButtons';
import { DangerButton } from '@/components/common/DangerButton';
import { StatusModal } from '@/components/common/StatusModal';
import { HeaderWithBack } from '@/components/common/HeaderWithBack';
import { PageLayout } from '@/components/layouts/PageLayout';
import logger from '@/services/logger';

export default function Settings() {
  const { language, setLocale } = useLanguage();
  const { measurementSystem, setMeasurementSystem } = useMeasurement();
  const { signOut } = useAuth();
  const { updateUserProfile } = useUserProfile();
  const { locales: activeLocales } = useActiveLocales(true);

  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const handleLanguageChange = async (newLanguage: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to use the device's full locale (e.g. es-MX) if it exists
      // in the locales table; otherwise fall back to the base code (es).
      const deviceLocales = getLocales();
      const matchingDevice = deviceLocales.find(
        (dl) => dl.languageCode === newLanguage
      );
      const deviceTag = matchingDevice?.languageTag;
      const knownCodes = activeLocales.map((l) => l.code);
      const newLocale =
        deviceTag && knownCodes.includes(deviceTag) ? deviceTag : newLanguage;

      await updateUserProfile({ locale: newLocale });

      // Update locale in context — this derives language and triggers the app restart dialog
      await setLocale(newLocale);

      setIsLoading(false);
    } catch (error) {
      logger.error('Error changing language:', error);
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
      logger.error('Error changing measurement system:', error);
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
      logger.error('Error signing out:', error);
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