import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import i18n from '@/i18n';
import { PageLayout } from '@/components/layouts/PageLayout';
import { GradientHeader } from '@/components/common/GradientHeader';
import { Text } from '@/components/common/Text';
import { AdventureStatsBar } from '@/components/adventure/AdventureStatsBar';
import { CourseCard } from '@/components/adventure/CourseCard';
import { CommunityActionCard } from '@/components/adventure/CommunityActionCard';
import { ADVENTURE_COURSES, ADVENTURE_REGIONS, getCourseLevels } from '@/data/adventure';
import { useAdventure } from '@/contexts/AdventureContext';

const AdventureHome = () => {
  const { progress } = useAdventure();

  return (
    <PageLayout
      scrollEnabled={true}
      header={(
        <GradientHeader contentClassName="px-md pb-md">
          <View className="py-lg">
            <Text preset="h1" className="text-3xl text-center">
              {i18n.t('adventure.courses.title')}
            </Text>
            <Text preset="body" className="text-center text-grey-dark mt-xs">
              {i18n.t('adventure.courses.subtitle')}
            </Text>
          </View>
        </GradientHeader>
      )}
    >
      <View className="py-md">
        <AdventureStatsBar
          streakLabel={i18n.t('adventure.stats.streak')}
          xpLabel={i18n.t('adventure.stats.xp')}
          coinsLabel={i18n.t('adventure.stats.coins')}
          streakValue={i18n.t('adventure.stats.streakValue', { count: progress.streak.current })}
          xpValue={i18n.t('adventure.stats.xpValue', { count: progress.totalXp })}
          coinsValue={i18n.t('adventure.stats.coinsValue', { count: progress.totalCoins })}
        />
      </View>

      {ADVENTURE_REGIONS.map((region) => {
        const courses = ADVENTURE_COURSES.filter((course) => region.courseIds.includes(course.id));
        if (courses.length === 0) return null;

        return (
          <View key={region.id} className="mb-lg">
            <Text preset="h2" className="text-2xl">
              {i18n.t(region.titleKey)}
            </Text>
            <Text preset="body" className="text-sm text-grey-dark mt-xs mb-sm">
              {i18n.t(region.descriptionKey)}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {courses.map((course) => {
                const levels = getCourseLevels(course.id);
                const completedCount = levels.filter((level) => progress.completedLevelIds.includes(level.id)).length;
                const progressLabel = i18n.t('adventure.courses.progressLabel', {
                  completed: completedCount,
                  total: Math.max(levels.length, course.levelIds.length),
                });
                const badgeLabel = course.isPlayable
                  ? i18n.t('adventure.courses.playable')
                  : i18n.t('adventure.courses.comingSoon');

                return (
                  <CourseCard
                    key={course.id}
                    title={i18n.t(course.titleKey)}
                    description={i18n.t(course.descriptionKey)}
                    progressLabel={progressLabel}
                    isPlayable={course.isPlayable}
                    badgeLabel={badgeLabel}
                    onPress={() => router.push(`/adventure/${course.id}`)}
                  />
                );
              })}
            </ScrollView>
          </View>
        );
      })}

      <View className="mt-lg">
        <Text preset="h2" className="text-2xl">
          {i18n.t('adventure.community.title')}
        </Text>
        <Text preset="body" className="text-sm text-grey-dark mt-xs mb-sm">
          {i18n.t('adventure.community.subtitle')}
        </Text>
        <View className="flex-row">
          <View className="flex-1 mr-md">
            <CommunityActionCard
              title={i18n.t('adventure.community.club.title')}
              description={i18n.t('adventure.community.club.description')}
              onPress={() => router.push('/adventure/club')}
            />
          </View>
          <View className="flex-1">
            <CommunityActionCard
              title={i18n.t('adventure.community.sharePlate.title')}
              description={i18n.t('adventure.community.sharePlate.description')}
              onPress={() => router.push('/adventure/share-plate')}
            />
          </View>
        </View>
      </View>
    </PageLayout>
  );
};

export default AdventureHome;
