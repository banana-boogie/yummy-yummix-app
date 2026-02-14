import React from 'react';
import { View, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useProfileImage } from '@/hooks/useProfileImage';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import i18n from '@/i18n';
import { COLORS } from '@/constants/design-tokens';

import ImageUpload from '@/components/profile/ImageUpload';
import { GradientHeader } from '@/components/common/GradientHeader';
import { PageLayout } from '@/components/layouts/PageLayout';
import { Ionicons } from '@expo/vector-icons';
import { HamburgerMenu } from '@/components/navigation/HamburgerMenu';
import { useDevice } from '@/hooks/useDevice';

export default function Profile() {
  const { userProfile, updateUserProfile, isAdmin, loading } = useUserProfile();
  const { deleteProfileImage } = useProfileImage();
  const { isWeb } = useDevice();

  const handleEditProfile = () => {
    router.push('/(tabs)/profile/edit-profile');
  };

  const handleSettings = () => {
    router.push('/(tabs)/profile/settings');
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

  const featureButtons = [
    {
      id: 'planner',
      visible: true,
      title: i18n.t('profile.features.planner'),
      icon: require('@/assets/images/user-profile/planner-icon.png'),
      route: '/(tabs)/profile/planner',
    },
    {
      id: 'recipes',
      visible: true,
      title: i18n.t('profile.features.recipes'),
      icon: require('@/assets/images/user-profile/recipes-icon.png'),
      route: '/(tabs)/profile/recipes',
    },
    {
      id: 'shopping',
      visible: true,
      title: i18n.t('profile.features.shoppingList'),
      icon: require('@/assets/images/user-profile/shopping-list-icon.png'),
      route: '/(tabs)/profile/shopping',
    },
    {
      id: 'achievements',
      visible: true,
      title: i18n.t('profile.features.achievements'),
      icon: require('@/assets/images/user-profile/achievements-icon.png'),
      route: '/(tabs)/profile/achievements',
    },
  ];

  const Header = () => (
    <GradientHeader
      className="mb-xl"
      contentClassName="max-w-[800px] mx-auto px-md"
    >
      <StatusBar barStyle="dark-content" />

      {loading && !userProfile ? (
        <View className="flex-1 justify-center items-center min-h-[200px]">
          <ActivityIndicator size="large" color={COLORS.grey.dark} />
        </View>
      ) :
        (
          <View className="mt-md px-md">
            {isWeb ? <HamburgerMenu className="ml-auto" /> : null}
            <View className="flex-row items-center mb-xxs">
              <View className="border-[3px] border-primary-medium rounded-full p-[2px]">
                <ImageUpload
                  url={userProfile?.profileImageUrl}
                  fileName={`${userProfile?.id}_${Date.now()}`}
                  onUpload={handleImageUpload}
                  onDelete={handleImageDelete}
                  showDeleteButton={false}
                  buttonClassName="w-[120px] h-[120px] shrink-0"
                />
              </View>
              <Text preset="h1" className="ml-md text-3xl flex-1" numberOfLines={2}>
                {userProfile?.name}
              </Text>
            </View>
            {userProfile?.biography ? (
              <Text preset="body" className="mt-xs mb-md" numberOfLines={4}>
                {userProfile.biography}
              </Text>
            ) : null}
            <View className="flex-row gap-md mb-xl">
              <Button
                label={i18n.t('profile.editProfile')}
                onPress={handleEditProfile}
                className="rounded-md py-xs px-md flex-1"
                textClassName="text-sm"
                variant="flat"
                size="small"
                icon={require('@/assets/images/user-profile/edit-icon.png')}
                iconClassName="w-[20px] h-[20px] mr-2"
              />
              <Button
                label={i18n.t('profile.settings')}
                onPress={handleSettings}
                className="rounded-md py-xs px-md flex-1"
                textClassName="text-sm"
                variant="flat"
                size="small"
                icon={require('@/assets/images/user-profile/settings-icon.png')}
                iconClassName="w-[20px] h-[20px] mr-2"
              />
            </View>
          </View>
        )}
    </GradientHeader>
  );

  return (
    <PageLayout scrollEnabled={true} contentPaddingHorizontal={0} disableMaxWidth={true}>
      <Header />
      <View className="w-full max-w-[800px] self-center px-md">
        {isAdmin ? (
          <TouchableOpacity
            className="mb-lg bg-background-default border border-grey-light rounded-sm flex-row items-center p-md"
            onPress={() => router.push('/admin')}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.grey.dark} />
            <Text preset="bodySmall" className="text-grey-dark flex-1 ml-sm">{i18n.t('admin.common.adminPanel')}</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.grey.medium} />
          </TouchableOpacity>
        ) : null}
        <Text preset="caption" className="text-text-secondary mb-sm">
          {i18n.t('profile.features.sectionTitle')}
        </Text>
        <View
          className="flex-row flex-wrap justify-between"
        >
          {featureButtons.filter(b => b.visible).map((button) => (
            <TouchableOpacity
              key={button.id}
              className="w-[48%] md:w-[30%] bg-background-default border border-primary-light rounded-lg p-md mb-lg items-center justify-center shadow-md"
              onPress={() => router.push(button.route as any)}
            >
              <Image
                source={button.icon}
                className="w-[64px] h-[64px] mb-3"
                transition={300}
                cachePolicy="memory-disk"
              />
              <Text
                preset="subheading"
                className="text-sm text-center text-text-default"
              >
                {button.title}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.grey.medium} style={{ marginTop: 4 }} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </PageLayout>
  );
}