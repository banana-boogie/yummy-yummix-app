import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import i18n from '@/i18n';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { AuthFooter } from '@/components/auth/AuthFooter';
import { EmailInput } from '@/components/form/EmailInput';
import { Button } from '@/components/common/Button';
import { AuthError } from '@/components/auth/AuthError';
import { EmailSentModal } from '@/components/auth/EmailSentModal';
import { useMagicLink } from '@/hooks/auth/useMagicLink';
import { useAppleAuth } from '@/hooks/auth/useAppleAuth';
import { useDevice } from '@/hooks/useDevice';
import { PageLayout } from '@/components/layouts/PageLayout';
import { AppleAuthButton } from '@/components/auth/AppleAuthButton';
import { Divider } from '@/components/common/Divider';


export default function LoginScreen() {
  const router = useRouter();

  const {
    email,
    setEmail,
    isEmailValid,
    setIsEmailValid,
    isLoading: isMagicLinkLoading,
    error: magicLinkError,
    showEmailSent,
    setShowEmailSent,
    handleMagicLink,
    handleOpenEmail,
  } = useMagicLink();

  const {
    isLoading: isAppleLoading,
    error: appleError,
    handleAppleSignIn,
  } = useAppleAuth();

  // Show the appropriate error
  const error = appleError || magicLinkError;

  const handleSignUp = () => router.push('/auth/signup');

  const { isLarge } = useDevice();

  return (
    <PageLayout
      header={<AuthHeader title={i18n.t('auth.emailAuth.login.title')} />}
      adjustForTabBar={false}
    >
      {/* Main content area */}
      <View
        className="flex-1 justify-start gap-lg"
      >
        {/* Flexible spacer at the top */}
        <View style={{ flex: isLarge ? 0.33 : 0.39 }} />

        {/* Error message when needed */}
        {error && (
          <AuthError message={error.message} className="mb-sm" />
        )}

        {/* Email input with bottom margin */}
        <EmailInput
          value={email}
          onChangeText={setEmail}
          onValidation={setIsEmailValid}
          placeholder={i18n.t('auth.emailAuth.login.emailPlaceholder')}
          placeholderTextColor="#828181"
        />

        {/* Submit button */}
        <Button
          label={isMagicLinkLoading ? i18n.t('auth.emailAuth.confirmation.sending') : i18n.t('auth.emailAuth.login.submit')}
          onPress={handleMagicLink}
          disabled={!isEmailValid || isMagicLinkLoading || isAppleLoading}
          loading={isMagicLinkLoading}
          variant="primary"
        />

        {/* Apple Sign-in button */}
        <Divider text={i18n.t('auth.common.or')} />

        <AppleAuthButton
          onPress={handleAppleSignIn}
          isLoading={isAppleLoading}
          isSignUp={false}
        />
      </View>

      {/* Footer with sign up link */}
      <AuthFooter
        message={i18n.t('auth.common.noAccount')}
        linkText={i18n.t('auth.common.signUp')}
        onLinkPress={handleSignUp}
      />

      {/* Modal for email sent confirmation */}
      <EmailSentModal
        visible={showEmailSent}
        email={email}
        onOpenEmail={handleOpenEmail}
        onClose={() => setShowEmailSent(false)}
      />
    </PageLayout>
  );
}