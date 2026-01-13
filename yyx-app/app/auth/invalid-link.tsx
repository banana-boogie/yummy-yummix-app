import React from 'react';
import { View } from 'react-native';
import i18n from '@/i18n';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { useDevice } from '@/hooks/useDevice';
import { PageLayout } from '@/components/layouts/PageLayout';
import { router } from 'expo-router';

export default function InvalidLinkScreen() {
  const { isLarge, isMedium } = useDevice();

  const handleRequestNewLink = () => {
    router.replace('/auth/login');
  };

  return (
    <PageLayout
      adjustForTabBar={false}
      header={
        <AuthHeader
          title={i18n.t('auth.emailAuth.invalidLink.title')}
          showBackButton={false}
        />
      }>
      <View className="flex-1 justify-start items-center">
        {/* Spacer with responsive height */}
        <View style={{ height: isLarge ? 64 : isMedium ? 48 : 32 }} />

        <Text preset="h1" className="mb-md text-center">
          {i18n.t('auth.emailAuth.invalidLink.heading')}
        </Text>

        <Text preset="body" className="text-center text-text-secondary px-lg mb-xl">
          {i18n.t('auth.emailAuth.invalidLink.message')}
        </Text>

        <Button
          label={i18n.t('auth.emailAuth.invalidLink.tryAgain')}
          onPress={handleRequestNewLink}
          variant="primary"
          className="w-full max-w-[400px] md:max-w-[500px] lg:max-w-[600px]"
        />
      </View>
    </PageLayout>
  );
}