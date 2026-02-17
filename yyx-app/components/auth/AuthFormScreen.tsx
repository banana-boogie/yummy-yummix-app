import React, { useState } from 'react';
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
import { COLORS } from '@/constants/design-tokens';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { userProfileKeys } from '@/lib/queryKeys';

interface AuthFormScreenProps {
  mode: 'login' | 'signup';
}

export function AuthFormScreen({ mode }: AuthFormScreenProps) {
  const router = useRouter();
  const [devError, setDevError] = useState<{ message: string } | null>(null);
  const [isDevLoading, setIsDevLoading] = useState(false);

  const isLogin = mode === 'login';
  const i18nPrefix = `auth.emailAuth.${mode}`;

  const devEmail = process.env.EXPO_PUBLIC_DEV_LOGIN_EMAIL;
  const devPassword = process.env.EXPO_PUBLIC_DEV_LOGIN_PASSWORD;
  const showDevLogin = __DEV__ && !!devEmail && !!devPassword;

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

  const error = devError || appleError || magicLinkError;

  const handleDevLogin = async () => {
    if (!devEmail || !devPassword) {
      setDevError({ message: i18n.t('auth.devLogin.missingCredentials') });
      return;
    }

    setDevError(null);
    setIsDevLoading(true);
    try {
      if (isLogin) {
        queryClient.removeQueries({ queryKey: userProfileKeys.all });
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: devEmail,
        password: devPassword,
      });

      if (loginError) {
        setDevError({ message: i18n.t('auth.devLogin.failed') });
      }
    } catch {
      setDevError({ message: i18n.t('auth.devLogin.failed') });
    } finally {
      setIsDevLoading(false);
    }
  };

  const handleNavigateAway = () => {
    if (isLogin) {
      router.push('/auth/signup');
    } else {
      router.push('/auth/login');
    }
  };

  const { isLarge } = useDevice();

  return (
    <PageLayout
      header={<AuthHeader title={i18n.t(`${i18nPrefix}.title`)} />}
      adjustForTabBar={false}
    >
      <View className="flex-1 justify-start gap-lg">
        <View style={{ flex: isLarge ? 0.33 : 0.39 }} />

        {error && (
          <AuthError message={error.message} className="mb-sm" />
        )}

        <EmailInput
          value={email}
          onChangeText={setEmail}
          onValidation={setIsEmailValid}
          placeholder={i18n.t(`${i18nPrefix}.emailPlaceholder`)}
          placeholderTextColor={COLORS.text.secondary}
        />

        <Button
          label={isMagicLinkLoading ? i18n.t('auth.emailAuth.confirmation.sending') : i18n.t(`${i18nPrefix}.submit`)}
          onPress={handleMagicLink}
          disabled={!isEmailValid || isMagicLinkLoading || isAppleLoading || isDevLoading}
          loading={isMagicLinkLoading}
          variant="primary"
        />

        <Divider text={i18n.t('auth.common.or')} />

        <AppleAuthButton
          onPress={handleAppleSignIn}
          isLoading={isAppleLoading}
          isSignUp={!isLogin}
        />

        {showDevLogin && (
          <>
            <Divider text={i18n.t('auth.devLogin.orDev')} />
            <Button
              label={isDevLoading ? i18n.t('auth.devLogin.signingIn') : i18n.t('auth.devLogin.button')}
              onPress={handleDevLogin}
              disabled={isDevLoading || isMagicLinkLoading || isAppleLoading}
              loading={isDevLoading}
              variant="secondary"
            />
          </>
        )}
      </View>

      <AuthFooter
        message={i18n.t(isLogin ? 'auth.common.noAccount' : 'auth.common.haveAccount')}
        linkText={i18n.t(isLogin ? 'auth.common.signUp' : 'auth.common.login')}
        onLinkPress={handleNavigateAway}
      />

      <EmailSentModal
        visible={showEmailSent}
        email={email}
        onOpenEmail={handleOpenEmail}
        onClose={() => setShowEmailSent(false)}
      />
    </PageLayout>
  );
}
