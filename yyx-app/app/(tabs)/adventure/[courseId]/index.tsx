import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import i18n from '@/i18n';
import { PageLayout } from '@/components/layouts/PageLayout';
import { HeaderWithBack } from '@/components/common/HeaderWithBack';
import { Text } from '@/components/common/Text';
import { AdventureStatsBar } from '@/components/adventure/AdventureStatsBar';
import { LevelNode } from '@/components/adventure/LevelNode';
import { IrmixyGuide } from '@/components/adventure/IrmixyGuide';
import { getAdventureCourseById, getCourseLevels } from '@/data/adventure';
import { useAdventure } from '@/contexts/AdventureContext';
import type { LevelStatus } from '@/types/adventure';

const CourseDetail = () => {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const { progress } = useAdventure();
  const course = getAdventureCourseById(courseId);
  const levels = course ? getCourseLevels(course.id) : [];

  if (!course) {
    return (
      <PageLayout>
        <Text preset="body">{i18n.t('adventure.course.notFound')}</Text>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      scrollEnabled={true}
      header={<HeaderWithBack title={i18n.t(course.titleKey)} />}
      contentContainerStyle={{ paddingBottom: 140 }}
    >
      <View className="py-md">
        <Text preset="body" className="text-sm text-grey-dark mb-md">
          {i18n.t(course.descriptionKey)}
        </Text>
        <AdventureStatsBar
          streakLabel={i18n.t('adventure.stats.streak')}
          xpLabel={i18n.t('adventure.stats.xp')}
          coinsLabel={i18n.t('adventure.stats.coins')}
          streakValue={i18n.t('adventure.stats.streakValue', { count: progress.streak.current })}
          xpValue={i18n.t('adventure.stats.xpValue', { count: progress.totalXp })}
          coinsValue={i18n.t('adventure.stats.coinsValue', { count: progress.totalCoins })}
        />
      </View>

      <View className="relative">
        <View className="absolute left-5 top-3 bottom-3 w-[2px] bg-primary-light rounded-full" />
        <View className="absolute -right-10 top-10 w-40 h-40 rounded-full bg-primary-light opacity-40" />
        <View className="absolute -left-16 top-64 w-32 h-32 rounded-full bg-primary-light opacity-30" />
        {levels.map((level, index) => {
          const isCompleted = progress.completedLevelIds.includes(level.id);
          const isUnlocked = progress.unlockedLevelIds.includes(level.id);
          const status: LevelStatus = isCompleted ? 'completed' : isUnlocked ? 'unlocked' : 'locked';
          const durationLabel = i18n.t('adventure.level.duration', { count: level.durationMinutes });
          const rewardLabel = i18n.t('adventure.level.rewardsShort', {
            xp: level.xpReward,
            coins: level.coinReward,
          });

          return (
            <View key={level.id} className={index < levels.length - 1 ? 'mb-lg' : ''}>
              <LevelNode
                title={i18n.t(level.titleKey)}
                description={i18n.t(level.descriptionKey)}
                durationLabel={durationLabel}
                rewardLabel={rewardLabel}
                status={status}
                showConnector={index < levels.length - 1}
                index={index}
                onPress={() => router.push(`/adventure/${course.id}/level/${level.id}`)}
              />
            </View>
          );
        })}
      </View>

      <IrmixyGuide message={i18n.t('adventure.irmixy.courseHint')} />
    </PageLayout>
  );
};

export default CourseDetail;
