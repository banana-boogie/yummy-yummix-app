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
import { PageLayout } from '@/components/layouts/PageLayout';
import { useDevice } from '@/hooks/useDevice';
import { AppleAuthButton } from '@/components/auth/AppleAuthButton';
import { Divider } from '@/components/common/Divider';
import { COLORS } from '@/constants/design-tokens';


export default function SignUpScreen() {
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

  const handleLogin = () => router.push('/auth/login');

  const { isLarge } = useDevice();

  return (
    <PageLayout
      header={<AuthHeader title={i18n.t('auth.emailAuth.signup.title')} />}
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

        {/* Email input */}
        <EmailInput
          value={email}
          onChangeText={setEmail}
          onValidation={setIsEmailValid}
          placeholder={i18n.t('auth.emailAuth.signup.emailPlaceholder')}
          placeholderTextColor={COLORS.grey.medium_dark}
        />

        {/* Submit button */}
        <Button
          label={isMagicLinkLoading ? i18n.t('auth.emailAuth.confirmation.sending') : i18n.t('auth.emailAuth.signup.submit')}
          onPress={handleMagicLink}
          disabled={!isEmailValid || isMagicLinkLoading || isAppleLoading}
          loading={isMagicLinkLoading}
          variant="primary"
        />

        {/* Apple Sign-up button */}
        <Divider text={i18n.t('auth.common.or')} />

        <AppleAuthButton
          onPress={handleAppleSignIn}
          isLoading={isAppleLoading}
          isSignUp={true}
        />
      </View>

      {/* Footer with sign in link */}
      <AuthFooter
        message={i18n.t('auth.common.haveAccount')}
        linkText={i18n.t('auth.common.login')}
        onLinkPress={handleLogin}
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