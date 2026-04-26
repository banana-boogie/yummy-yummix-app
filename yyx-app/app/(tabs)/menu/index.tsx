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
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import i18n from '@/i18n';
import { COLORS } from '@/constants/design-tokens';
import type { GeneratePlanOptions } from '@/types/mealPlan';

/**
 * Explicit setup signal — do not infer from `preferences.mealTypes.length`,
 * because the backend stub returns default preferences that make every new
 * user look configured. The flag is set only after the user confirms the
 * guided setup flow.
 */
const SETUP_COMPLETED_KEY = 'planner.setupCompleted';

type MenuMode = 'today' | 'week';

export default function MenuScreen() {
  const [setupMode, setSetupMode] = useState<'first-time' | 'settings' | null>(
    null,
  );
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);
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
    generateShoppingList,
    planProgress,
    todaysSlots,
    hasCachedPlan,
    refetch,
  } = useMealPlan();

  // Refs for a11y focus shifts when toggling between today/week. Per F5.
  const weekHeaderRef = useRef<View>(null);
  const todayHeroRef = useRef<View>(null);

  useEffect(() => {
    AsyncStorage.getItem(SETUP_COMPLETED_KEY)
      .then((v) => setSetupCompleted(v === 'true'))
      .catch(() => setSetupCompleted(false));
  }, []);

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
  useEffect(() => {
    const target =
      mode === 'week' ? weekHeaderRef.current : todayHeroRef.current;
    if (!target) return;
    const node = findNodeHandle(target);
    if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [mode]);

  const handlePlanPress = useCallback(() => {
    if (!setupCompleted) {
      setSetupMode('first-time');
      return;
    }
    generatePlan({
      dayIndexes: preferences?.activeDayIndexes,
      mealTypes: preferences?.mealTypes,
      busyDays: preferences?.busyDays,
      preferLeftoversForLunch: preferences?.preferLeftoversForLunch,
    });
  }, [setupCompleted, generatePlan, preferences]);

  const handleSetupComplete = useCallback(
    async (answers: GeneratePlanOptions) => {
      // Persist + generate first. Only dismiss the flow on success so failures
      // are visible instead of silently dropping the user back to the screen.
      try {
        await updatePreferences({
          dayIndexes: answers.dayIndexes,
          mealTypes: answers.mealTypes,
          busyDays: answers.busyDays,
        });
        await AsyncStorage.setItem(SETUP_COMPLETED_KEY, 'true');
        await generatePlan(answers);
        setSetupCompleted(true);
        setSetupMode(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Alert.alert(i18n.t('planner.error.setupTitle'), message);
      }
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
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(i18n.t('planner.error.shoppingListTitle'), message);
    } finally {
      setApproving(false);
    }
  }, [activePlan, generateShoppingList]);

  const handleRemove = useCallback(
    (slot: { id: string }) => {
      // Remove dims the card via skip_meal (no dedicated "remove" action yet —
      // keep server contract intact, surface as "Remove" in UI).
      skipSlot(slot.id);
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
  // Stub backend may return plan: null after generate_plan. Show a dedicated
  // "we're still putting your menu together" state instead of bouncing to the
  // empty CTA.
  const showGeneratingPlaceholder =
    setupCompleted === true && isGenerating && !hasPlan;
  const showPlanPendingPlaceholder =
    setupCompleted === true && !isGenerating && !hasPlan && !isLoading;

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
    // setup-rehydrating uses ActivityIndicator (not a plan-load state). Plan
    // initial load in today-mode renders the skeleton (F7).
    if (setupCompleted === null) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={COLORS.primary.darkest} />
        </View>
      );
    }
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

    if (showPlanPendingPlaceholder) {
      return (
        <View className="flex-1 items-center justify-center px-lg">
          <Text preset="body" className="text-center text-text-secondary">
            {i18n.t('planner.planReadyPlaceholder')}
          </Text>
          <Pressable
            onPress={handlePlanPress}
            className="mt-lg px-xl py-md rounded-full bg-primary-medium"
            style={{ minHeight: 44 }}
            accessibilityLabel={i18n.t('planner.empty.planMyMenu')}
          >
            <Text preset="body">{i18n.t('planner.empty.planMyMenu')}</Text>
          </Pressable>
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
