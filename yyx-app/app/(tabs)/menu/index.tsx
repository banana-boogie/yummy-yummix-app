import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  BackHandler,
  findNodeHandle,
  Platform,
  Pressable,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { PageLayout } from '@/components/layouts/PageLayout';
import { ResponsiveLayout } from '@/components/layouts/ResponsiveLayout';
import { Text } from '@/components/common';
import { useMealPlan } from '@/hooks/useMealPlan';
import { MealPlanEmptyState } from '@/components/planner/MealPlanEmptyState';
import { FirstTimePlanSetupFlow } from '@/components/planner/FirstTimePlanSetupFlow';
import { MealPlanView } from '@/components/planner/MealPlanView';
import {
  TodayHero,
  TodayHeroError,
  TodayHeroSkeleton,
} from '@/components/planner/TodayHero';
import { todayDayIndex } from '@/components/planner/utils/dayIndex';
import { eventService } from '@/services/eventService';
import { mealPlannerErrorMessage } from '@/services/mealPlanService';
import i18n from '@/i18n';
import { COLORS } from '@/constants/design-tokens';
import type { GeneratePlanOptions } from '@/types/mealPlan';

type MenuMode = 'today' | 'week';

export default function MenuScreen() {
  const [setupMode, setSetupMode] = useState<'first-time' | 'settings' | null>(
    null,
  );
  const [approving, setApproving] = useState(false);
  const [mode, setMode] = useState<MenuMode>('today');
  const [refreshing, setRefreshing] = useState(false);

  const {
    activePlan,
    preferences,
    isLoading,
    isGenerating,
    error,
    generatePlan,
    updatePreferences,
    skipSlot,
    swapSlot,
    applySwap,
    generateShoppingList,
    planProgress,
    todaysSlots,
    hasCachedPlan,
    refetch,
  } = useMealPlan();

  // Server-derived: true once the user has completed the setup flow at least
  // once. Backed by a `setup_completed_at` timestamp on the preferences row,
  // so it survives reinstall and works across devices.
  const setupCompleted = preferences?.setupCompletedAt != null;

  // Refs for a11y focus shifts when toggling between today/week. Per F5.
  const weekHeaderRef = useRef<View>(null);
  const todayHeroRef = useRef<View>(null);

  // Hardware back: when in week mode, intercept and return to today instead
  // of leaving the tab. Android-only; iOS has no hardware back, web has no
  // BackHandler.
  useEffect(() => {
    if (mode !== 'week' || Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      eventService.logPlannerModeChange({
        from: 'week',
        to: 'today',
        trigger: 'hardware-back',
      });
      setMode('today');
      return true;
    });
    return () => sub.remove();
  }, [mode]);

  const handleSeeWeek = useCallback(() => {
    eventService.logPlannerModeChange({
      from: 'today',
      to: 'week',
      trigger: 'link',
    });
    setMode('week');
  }, []);

  const handleBackToToday = useCallback(() => {
    eventService.logPlannerModeChange({
      from: 'week',
      to: 'today',
      trigger: 'back-button',
    });
    setMode('today');
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // After the user toggles modes, shift screen-reader focus to the new
  // primary surface so VoiceOver/TalkBack announce the change (F5).
  // Defer to the next frame so refs are populated after the render that
  // mounts the new surface; otherwise findNodeHandle returns null and
  // VoiceOver never announces the toggle.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const target =
        mode === 'week' ? weekHeaderRef.current : todayHeroRef.current;
      if (!target) return;
      const node = findNodeHandle(target);
      if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
    });
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const handlePlanPress = useCallback(async () => {
    if (!setupCompleted) {
      setSetupMode('first-time');
      return;
    }
    try {
      await generatePlan({
        dayIndexes: preferences?.activeDayIndexes,
        mealTypes: preferences?.mealTypes,
        busyDays: preferences?.busyDays,
        autoLeftovers: preferences?.autoLeftovers,
      });
    } catch (err) {
      Alert.alert(
        i18n.t('planner.error.generateTitle'),
        mealPlannerErrorMessage(err),
      );
    }
  }, [setupCompleted, generatePlan, preferences]);

  const handleSetupComplete = useCallback(
    async (answers: GeneratePlanOptions) => {
      // Two-step flow: save preferences, then generate the plan. Title the
      // alert by the step that actually failed so the user isn't blamed for
      // the wrong action.
      try {
        await updatePreferences({
          dayIndexes: answers.dayIndexes,
          mealTypes: answers.mealTypes,
          busyDays: answers.busyDays,
        });
      } catch (err) {
        Alert.alert(
          i18n.t('planner.error.setupTitle'),
          mealPlannerErrorMessage(err),
        );
        return;
      }
      try {
        // updatePreferences sets setup_completed_at server-side on the first
        // save, so by the time generatePlan runs the user is "onboarded" from
        // the server's perspective. If generatePlan rejects, the user still
        // sees the "ready" empty state on retry — no stranded "completed but
        // no plan" UI state.
        await generatePlan(answers);
      } catch (err) {
        Alert.alert(
          i18n.t('planner.error.generateTitle'),
          mealPlannerErrorMessage(err),
        );
        return;
      }
      // Land on the week view after a fresh generation so the user can review
      // and adjust the whole plan before approving. Today view (the default)
      // takes over once they navigate back via "Back to today" or relaunch.
      setMode('week');
      setSetupMode(null);
    },
    [generatePlan, updatePreferences],
  );

  const handleApprove = useCallback(async () => {
    if (!activePlan) return;
    setApproving(true);
    try {
      await generateShoppingList();
      router.push('/(tabs)/shopping' as never);
    } catch (err) {
      Alert.alert(
        i18n.t('planner.error.shoppingListTitle'),
        mealPlannerErrorMessage(err),
      );
    } finally {
      setApproving(false);
    }
  }, [activePlan, generateShoppingList]);

  const handleRemove = useCallback(
    async (slot: { id: string }) => {
      // Remove dims the card via skip_meal (no dedicated "remove" action yet —
      // keep server contract intact, surface as "Remove" in UI).
      try {
        await skipSlot(slot.id);
      } catch (err) {
        Alert.alert(
          i18n.t('planner.error.removeTitle'),
          mealPlannerErrorMessage(err),
        );
      }
    },
    [skipSlot],
  );

  if (setupMode) {
    return (
      <FirstTimePlanSetupFlow
        mode={setupMode}
        initialPreferences={preferences ?? undefined}
        onCancel={() => setSetupMode(null)}
        onComplete={handleSetupComplete}
      />
    );
  }

  const hasPlan = !!activePlan && activePlan.slots.length > 0;
  const showGeneratingPlaceholder = setupCompleted && isGenerating && !hasPlan;

  // Header content depends on mode.
  const renderHeader = () => {
    if (mode === 'week' && hasPlan) {
      return (
        <View
          ref={weekHeaderRef}
          accessible
          accessibilityLabel={i18n.t('planner.title')}
          className="flex-row items-center justify-between px-lg pt-lg pb-sm"
        >
          <Pressable
            onPress={handleBackToToday}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('planner.today.backToToday')}
            hitSlop={12}
            className="flex-row items-center"
            style={{ minHeight: 44 }}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={COLORS.primary.darkest}
            />
            <Text preset="body" className="text-primary-darkest ml-xxs">
              {i18n.t('planner.today.backToToday')}
            </Text>
          </Pressable>
          {setupCompleted && (
            <Pressable
              onPress={() => setSetupMode('settings')}
              accessibilityLabel={i18n.t('planner.openSettings')}
              hitSlop={12}
            >
              <Ionicons
                name="settings-outline"
                size={24}
                color={COLORS.text.default}
              />
            </Pressable>
          )}
        </View>
      );
    }
    return (
      <View className="flex-row items-center justify-between px-lg pt-lg pb-sm">
        <Text preset="h1">{i18n.t('planner.title')}</Text>
        {setupCompleted && (
          <Pressable
            onPress={() => setSetupMode('settings')}
            accessibilityLabel={i18n.t('planner.openSettings')}
            hitSlop={12}
          >
            <Ionicons
              name="settings-outline"
              size={24}
              color={COLORS.text.default}
            />
          </Pressable>
        )}
      </View>
    );
  };

  const renderBody = () => {
    if (isLoading) {
      return mode === 'today' ? (
        <TodayHeroSkeleton />
      ) : (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={COLORS.primary.darkest} />
        </View>
      );
    }

    // Blocking error: query failed and we have no cached plan to fall back on.
    // Without cached data there's nothing to show, so retry is the only path.
    if (mode === 'today' && error && !hasCachedPlan) {
      return <TodayHeroError onRetry={handleRefresh} />;
    }

    if (hasPlan) {
      if (mode === 'today') {
        return (
          <ResponsiveLayout maxWidth={600}>
            {/* Non-blocking error: revalidation failed but we still have stale
                cached plan data. Surface a slim banner; keep the hero usable. */}
            {error && hasCachedPlan && (
              <Pressable
                onPress={handleRefresh}
                accessibilityRole="button"
                accessibilityLabel={`${i18n.t('planner.today.staleDataNotice')} — ${i18n.t('planner.today.staleDataAction')}`}
                className="bg-primary-lighter px-md py-sm flex-row items-center justify-between"
                style={{ minHeight: 44 }}
              >
                <Text preset="bodySmall" className="text-text-default">
                  {i18n.t('planner.today.staleDataNotice')}
                </Text>
                <Text preset="link" className="text-primary-darkest">
                  {i18n.t('planner.today.staleDataAction')}
                </Text>
              </Pressable>
            )}
            <TodayHero
              ref={todayHeroRef}
              plan={activePlan}
              todaysSlots={todaysSlots}
              preferences={preferences}
              onRefresh={handleRefresh}
              isRefreshing={refreshing}
              onSeeWeek={handleSeeWeek}
              onSwap={swapSlot}
              onApplySwap={applySwap}
            />
          </ResponsiveLayout>
        );
      }
      return (
        <MealPlanView
          plan={activePlan}
          todayDayIndex={todayDayIndex()}
          progress={planProgress}
          isApproving={approving}
          onApprove={handleApprove}
          onRemove={handleRemove}
        />
      );
    }

    if (showGeneratingPlaceholder) {
      return (
        <View className="flex-1 items-center justify-center px-lg">
          <ActivityIndicator color={COLORS.primary.darkest} />
          <Text preset="body" className="text-center mt-md">
            {i18n.t('planner.setup.generating')}
          </Text>
        </View>
      );
    }

    return (
      <MealPlanEmptyState
        variant={setupCompleted ? 'ready' : 'first-time'}
        onPressPlan={handlePlanPress}
        loading={isGenerating}
      />
    );
  };

  return <PageLayout header={renderHeader()}>{renderBody()}</PageLayout>;
}
