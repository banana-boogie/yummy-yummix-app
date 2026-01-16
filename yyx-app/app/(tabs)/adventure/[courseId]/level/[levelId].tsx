import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import i18n from '@/i18n';
import { PageLayout } from '@/components/layouts/PageLayout';
import { HeaderWithBack } from '@/components/common/HeaderWithBack';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { IrmixyGuide } from '@/components/adventure/IrmixyGuide';
import { getAdventureCourseById, getAdventureLevelById, getCourseLevels } from '@/data/adventure';
import { useAdventure } from '@/contexts/AdventureContext';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { ConfettiBurst } from '@/components/adventure/ConfettiBurst';
import * as Haptics from 'expo-haptics';

const LevelDetail = () => {
  const { courseId, levelId } = useLocalSearchParams<{ courseId: string; levelId: string }>();
  const { progress, completeLevel } = useAdventure();
  const course = getAdventureCourseById(courseId);
  const level = getAdventureLevelById(levelId);
  const [showRewards, setShowRewards] = useState(false);
  const warmupTotal = 60;
  const stepKeys = level?.stepKeys ?? [];
  const stepCount = stepKeys.length;
  const [checkedSteps, setCheckedSteps] = useState<boolean[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [timerRemaining, setTimerRemaining] = useState(warmupTotal);
  const [timerRunning, setTimerRunning] = useState(false);
  const rewardScale = useRef(new Animated.Value(1)).current;

  if (!course || !level) {
    return (
      <PageLayout>
        <Text preset="body">{i18n.t('adventure.level.notFound')}</Text>
      </PageLayout>
    );
  }

  const isUnlocked = progress.unlockedLevelIds.includes(level.id);
  const isCompleted = progress.completedLevelIds.includes(level.id);
  const showWarmupTimer = level.id === 'basics-1';
  const timerDone = !showWarmupTimer || timerRemaining === 0;
  const stepsComplete = checkedSteps.length === 0 || checkedSteps.every(Boolean);

  const handleComplete = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeLevel(course.id, level.id);
    setShowRewards(true);
  };

  const nextLevelId = useMemo(() => {
    const courseLevels = getCourseLevels(course.id);
    const currentIndex = courseLevels.findIndex((entry) => entry.id === level.id);
    return currentIndex >= 0 ? courseLevels[currentIndex + 1]?.id ?? null : null;
  }, [course.id, level.id]);

  useEffect(() => {
    setCheckedSteps(stepKeys.map(() => false));
    setCurrentStepIndex(0);
    setTimerRemaining(warmupTotal);
    setTimerRunning(false);
    setShowRewards(false);
  }, [level.id, stepKeys, warmupTotal]);

  useEffect(() => {
    if (!timerRunning) return;
    if (timerRemaining <= 0) {
      setTimerRunning(false);
      return;
    }
    const timerId = setInterval(() => {
      setTimerRemaining((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timerId);
  }, [timerRunning, timerRemaining]);

  useEffect(() => {
    if (!showRewards) return;
    rewardScale.setValue(0);
    Animated.sequence([
      Animated.timing(rewardScale, {
        toValue: 1.1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.spring(rewardScale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();
  }, [rewardScale, showRewards]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentStepKey = stepKeys[currentStepIndex];
  const currentTipKey = level.id === 'basics-1'
    ? `adventure.levels.basics.1.tips.${currentStepIndex + 1}`
    : 'adventure.level.tipFallback';

  return (
    <PageLayout
      scrollEnabled={true}
      header={<HeaderWithBack title={i18n.t(level.titleKey)} />}
      contentContainerStyle={{ paddingBottom: 140 }}
    >
      <View className="py-md relative">
        <Text preset="body" className="text-sm text-grey-dark mb-md">
          {i18n.t(level.descriptionKey)}
        </Text>
        <View className="bg-white border border-primary-light rounded-2xl p-md mb-md">
          <Text preset="h3" className="text-lg">
            {i18n.t('adventure.level.detailsTitle')}
          </Text>
          <View className="mt-sm">
            <Text preset="caption" className="text-sm text-grey-dark mb-xs">
              {i18n.t('adventure.level.duration', { count: level.durationMinutes })}
            </Text>
            <Text preset="caption" className="text-sm text-grey-dark">
              {i18n.t('adventure.level.rewardsLong', { xp: level.xpReward, coins: level.coinReward })}
            </Text>
          </View>
        </View>

        <View className="bg-white border border-primary-light rounded-2xl p-md mb-md">
          <Text preset="h3" className="text-lg">
            {i18n.t('adventure.level.guidedTitle')}
          </Text>
          {stepCount > 0 ? (
            <>
              <View className="flex-row items-center justify-between mt-sm">
                <Text preset="caption" className="text-sm text-grey-dark">
                  {i18n.t('adventure.level.stepProgress', { current: currentStepIndex + 1, total: stepCount })}
                </Text>
                <Text preset="caption" className="text-sm text-grey-dark">
                  {i18n.t('adventure.level.stepProgressShort', { percent: Math.round((checkedSteps.filter(Boolean).length / stepCount) * 100) })}
                </Text>
              </View>
              <View className="h-2 bg-grey-light rounded-full overflow-hidden mt-xs">
                <View
                  className="h-2 bg-primary-medium"
                  style={{ width: `${(checkedSteps.filter(Boolean).length / stepCount) * 100}%` }}
                />
              </View>

              <View className="mt-md">
                <Text preset="body" className="text-sm text-grey-dark">
                  {i18n.t(currentStepKey)}
                </Text>
                <View className="mt-sm bg-primary-light rounded-xl p-sm border border-primary-light">
                  <Text preset="caption" className="text-xs text-grey-dark">
                    {i18n.t(currentTipKey)}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between mt-md">
                <Button
                  label={i18n.t('adventure.level.previousStep')}
                  onPress={() => setCurrentStepIndex((prev) => Math.max(prev - 1, 0))}
                  disabled={currentStepIndex === 0}
                  size="small"
                  variant="secondary"
                />
                <Button
                  label={checkedSteps[currentStepIndex]
                    ? i18n.t('adventure.level.stepDone')
                    : i18n.t('adventure.level.markStepDone')}
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    setCheckedSteps((current) =>
                      current.map((value, stepIndex) => (stepIndex === currentStepIndex ? true : value))
                    );
                    setCurrentStepIndex((prev) => Math.min(prev + 1, stepCount - 1));
                  }}
                  disabled={checkedSteps[currentStepIndex]}
                  size="small"
                />
              </View>

              <View className="mt-md">
                {stepKeys.map((stepKey, index) => (
                  <View key={stepKey} className={`flex-row items-center ${index < stepCount - 1 ? 'mb-xs' : ''}`}>
                    <View
                      className={`w-6 h-6 rounded-full items-center justify-center border ${checkedSteps[index] ? 'bg-primary-medium border-primary-medium' : 'bg-white border-grey-light'}`}
                    >
                      {checkedSteps[index] ? (
                        <Ionicons name="checkmark" size={14} color={COLORS.primary.darkest} />
                      ) : (
                        <Text preset="caption" className="text-[10px] text-grey-dark">
                          {index + 1}
                        </Text>
                      )}
                    </View>
                    <Text preset="body" className="text-sm text-grey-dark ml-sm">
                      {i18n.t(stepKey)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text preset="body" className="text-sm text-grey-dark mt-sm">
              {i18n.t('adventure.level.stepsComingSoon')}
            </Text>
          )}
        </View>

        {showWarmupTimer ? (
          <View className="bg-white border border-primary-light rounded-2xl p-md mb-md">
            <Text preset="h3" className="text-lg">
              {i18n.t('adventure.level.warmupTitle')}
            </Text>
            <Text preset="body" className="text-sm text-grey-dark mt-xs">
              {i18n.t('adventure.level.warmupDescription')}
            </Text>
            <View className="mt-sm">
              <View className="h-2 bg-grey-light rounded-full overflow-hidden">
                <View
                  className="h-2 bg-primary-medium"
                  style={{ width: `${((warmupTotal - timerRemaining) / warmupTotal) * 100}%` }}
                />
              </View>
              <View className="flex-row items-center justify-between mt-sm">
                <Text preset="caption" className="text-sm text-grey-dark">
                  {timerDone
                    ? i18n.t('adventure.level.warmupDone')
                    : i18n.t('adventure.level.warmupRunning', { time: formatTime(timerRemaining) })}
                </Text>
                <Button
                  label={timerRunning ? i18n.t('adventure.level.warmupRunningLabel') : i18n.t('adventure.level.warmupStart')}
                  onPress={() => setTimerRunning(true)}
                  disabled={timerRunning || timerDone}
                  size="small"
                  variant="secondary"
                />
              </View>
            </View>
          </View>
        ) : null}

        {showRewards || isCompleted ? (
          <View className="bg-primary-light border border-primary-light rounded-2xl p-md mb-md overflow-hidden">
            <ConfettiBurst active={showRewards} />
            <View className="flex-row items-center">
              <Animated.View
                className="w-14 h-14 rounded-full bg-white items-center justify-center mr-md"
                style={{ transform: [{ scale: rewardScale }] }}
              >
                <Ionicons name="ribbon" size={26} color={COLORS.primary.darkest} />
              </Animated.View>
              <View className="flex-1">
                <Text preset="h3" className="text-lg">
                  {i18n.t('adventure.level.completeTitle')}
                </Text>
                <Text preset="body" className="text-sm text-grey-dark mt-xs">
                  {i18n.t('adventure.level.completeSubtitle')}
                </Text>
              </View>
            </View>
            <View className="mt-sm">
              <Text preset="body" className="text-sm text-grey-dark">
                {i18n.t('adventure.level.badgeUnlocked')}
              </Text>
              <Text preset="body" className="text-sm text-grey-dark mt-xs">
                {i18n.t('adventure.level.rewardsLong', { xp: level.xpReward, coins: level.coinReward })}
              </Text>
              <Text preset="body" className="text-sm text-grey-dark mt-xs">
                {i18n.t('adventure.level.streakReward')}
              </Text>
            </View>
            <Button
              label={i18n.t('adventure.level.sharePlate')}
              onPress={() => router.push('/adventure/share-plate')}
              variant="secondary"
              fullWidth={true}
              className="mt-sm"
            />
          </View>
        ) : null}

        <Button
          label={
            isCompleted || showRewards
              ? i18n.t('adventure.level.backToCourse')
              : i18n.t('adventure.level.completeButton')
          }
          onPress={() => {
            if (isCompleted || showRewards) {
              router.replace(`/adventure/${course.id}`);
              return;
            }
            handleComplete();
          }}
          disabled={!isUnlocked || !stepsComplete || !timerDone}
          fullWidth={true}
        />

        {nextLevelId && (isCompleted || showRewards) ? (
          <Button
            label={i18n.t('adventure.level.nextLevel')}
            onPress={() => router.replace(`/adventure/${course.id}/level/${nextLevelId}`)}
            variant="secondary"
            fullWidth={true}
            className="mt-sm"
          />
        ) : null}
      </View>

      <IrmixyGuide message={i18n.t('adventure.irmixy.levelHint')} />
    </PageLayout>
  );
};

export default LevelDetail;
