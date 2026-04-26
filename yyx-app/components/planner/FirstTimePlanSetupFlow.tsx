/**
 * First-time meal plan setup — full-height guided flow.
 *
 * One question per step, auto-advance on selection. Collects days to plan,
 * busy days, and meal types. Returns the collected answers via `onComplete`
 * so the parent can call generatePlan() and/or persist preferences.
 *
 * Household size and nutrition goals are deferred: the first is handled at
 * the profile level (no planner contract yet), and the second is gated on
 * FEATURE_NUTRITION_GOALS once that flag is plumbed through.
 */

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button } from '@/components/common';
import { useLanguage } from '@/contexts/LanguageContext';
import i18n from '@/i18n';
import { COLORS } from '@/constants/design-tokens';
import { primaryMealTypeForLocale } from '@/components/planner/utils/primaryMealType';
import type {
  GeneratePlanOptions,
  PreferencesResponse,
} from '@/types/mealPlan';

interface FirstTimePlanSetupFlowProps {
  initialPreferences?: PreferencesResponse;
  /**
   * `first-time` hides already-answered steps (fast onboarding).
   * `settings` shows every step so the user can edit any answer.
   */
  mode?: 'first-time' | 'settings';
  onCancel: () => void;
  onComplete: (answers: GeneratePlanOptions) => Promise<void> | void;
}

type DaysPreset = 'weekdays' | 'every_day' | 'custom';

const WEEKDAY_INDEXES = [0, 1, 2, 3, 4];
const EVERY_DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6];

const DAY_LABEL_KEYS = [
  'planner.days.mon',
  'planner.days.tue',
  'planner.days.wed',
  'planner.days.thu',
  'planner.days.fri',
  'planner.days.sat',
  'planner.days.sun',
] as const;

interface MealTypeOption {
  id: string;
  mealTypes: string[];
  labelKey: string;
}

function getMealTypeOptions(locale: string): MealTypeOption[] {
  // For es-MX, the midday meal ("comida") is the canonical `lunch` on the server.
  // We send canonical meal types to the API regardless; only the label is localized.
  return [
    {
      id: 'lunch_or_dinner',
      mealTypes: [primaryMealTypeForLocale(locale)],
      labelKey: 'planner.mealTypes.dinnersOnly',
    },
    {
      id: 'lunch_dinner',
      mealTypes: ['lunch', 'dinner'],
      labelKey: 'planner.mealTypes.lunchAndDinner',
    },
    {
      id: 'breakfast_lunch',
      mealTypes: ['breakfast', 'lunch'],
      labelKey: 'planner.mealTypes.breakfastAndLunch',
    },
    {
      id: 'breakfast_lunch_dinner',
      mealTypes: ['breakfast', 'lunch', 'dinner'],
      labelKey: 'planner.mealTypes.allThree',
    },
  ];
}

export function FirstTimePlanSetupFlow({
  initialPreferences,
  mode = 'first-time',
  onCancel,
  onComplete,
}: FirstTimePlanSetupFlowProps) {
  const { locale } = useLanguage();

  // Settings mode always shows every step so saved values stay editable.
  // First-time mode skips already-answered steps for a fast onboarding path.
  const hasSavedDays = !!initialPreferences?.activeDayIndexes?.length;
  const hasSavedBusy = !!initialPreferences?.busyDays?.length;
  const hasSavedMealTypes = !!initialPreferences?.mealTypes?.length;
  const isSettings = mode === 'settings';

  // Household size is handled at the profile level, not the planner contract.
  // Revisit if/when the planner API accepts householdSize.
  const steps = useMemo(
    () => {
      const all: ('days' | 'busy' | 'mealTypes')[] = [];
      if (isSettings || !hasSavedDays) all.push('days');
      if (isSettings || !hasSavedBusy) all.push('busy');
      if (isSettings || !hasSavedMealTypes) all.push('mealTypes');
      return all;
    },
    [isSettings, hasSavedDays, hasSavedBusy, hasSavedMealTypes],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [daysPreset, setDaysPreset] = useState<DaysPreset | null>(
    hasSavedDays ? 'custom' : null,
  );
  const [dayIndexes, setDayIndexes] = useState<number[]>(
    initialPreferences?.activeDayIndexes ?? [],
  );
  const [busyDays, setBusyDays] = useState<number[]>(
    initialPreferences?.busyDays ?? [],
  );
  const [mealTypes, setMealTypes] = useState<string[]>(
    initialPreferences?.mealTypes ?? [],
  );
  const [includeBeverages, setIncludeBeverages] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const current = steps[stepIndex];

  const back = useCallback(() => {
    if (stepIndex === 0) {
      onCancel();
      return;
    }
    setStepIndex((i) => i - 1);
  }, [stepIndex, onCancel]);

  const toggleDay = useCallback((i: number) => {
    setDayIndexes((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort(),
    );
  }, []);

  const toggleBusy = useCallback((i: number) => {
    setBusyDays((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort(),
    );
  }, []);

  const finish = useCallback(async (overrides: GeneratePlanOptions = {}) => {
    setSubmitting(true);
    try {
      const selectedMealTypes = overrides.mealTypes ?? mealTypes;
      const finalMealTypes = includeBeverages
        ? [...selectedMealTypes, 'beverage']
        : selectedMealTypes;
      const selectedDayIndexes = overrides.dayIndexes ?? dayIndexes;
      await onComplete({
        dayIndexes: selectedDayIndexes.length
          ? selectedDayIndexes
          : WEEKDAY_INDEXES,
        mealTypes: finalMealTypes.length ? finalMealTypes : ['dinner'],
        busyDays: overrides.busyDays ?? busyDays,
      });
    } catch {
      // onComplete owns error surfacing (Alert in the parent). Swallow here
      // so rejections don't bubble out of the event handler as unhandled.
    } finally {
      setSubmitting(false);
    }
  }, [dayIndexes, mealTypes, busyDays, includeBeverages, onComplete]);

  // Advance to the next step, or finish if we're past the last one. Used by
  // every Continue affordance so first-time users with pre-answered steps
  // don't get stuck on the submitting spinner forever (F2).
  const goNextOrFinish = useCallback((overrides: GeneratePlanOptions = {}) => {
    if (stepIndex + 1 >= steps.length) {
      void finish(overrides);
      return;
    }
    setStepIndex((i) => i + 1);
  }, [stepIndex, steps.length, finish]);

  // Edge case: user enters first-time mode with every step already answered
  // (e.g. preferences pre-populated). `steps` is empty, so neither finish nor
  // a step renders — auto-finish once on mount instead of trapping the user.
  const autoFinishedRef = useRef(false);
  useEffect(() => {
    if (steps.length === 0 && !autoFinishedRef.current) {
      autoFinishedRef.current = true;
      void finish();
    }
  }, [steps.length, finish]);

  // If setup is complete, auto-finish.
  if (stepIndex >= steps.length) {
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
    <View className="flex-1 bg-background-default">
      <View className="flex-row items-center justify-between px-lg pt-xl pb-sm">
        <Pressable
          onPress={back}
          accessibilityLabel={i18n.t('common.back')}
          hitSlop={12}
        >
          <Ionicons
            name="chevron-back"
            size={28}
            color={COLORS.text.default}
          />
        </Pressable>
        <Text preset="caption" className="text-text-secondary">
          {i18n.t('planner.setup.stepOf', {
            current: stepIndex + 1,
            total: steps.length,
          })}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
      >
        {current === 'days' && (
          <StepContainer
            title={i18n.t('planner.setup.daysTitle')}
            helper={i18n.t('planner.setup.daysHelper')}
          >
            <ChoiceButton
              selected={daysPreset === 'weekdays'}
              label={i18n.t('planner.setup.daysWeekdays')}
              onPress={() => {
                setDaysPreset('weekdays');
                setDayIndexes(WEEKDAY_INDEXES);
                goNextOrFinish({ dayIndexes: WEEKDAY_INDEXES });
              }}
            />
            <ChoiceButton
              selected={daysPreset === 'every_day'}
              label={i18n.t('planner.setup.daysEveryDay')}
              onPress={() => {
                setDaysPreset('every_day');
                setDayIndexes(EVERY_DAY_INDEXES);
                goNextOrFinish({ dayIndexes: EVERY_DAY_INDEXES });
              }}
            />
            <ChoiceButton
              selected={daysPreset === 'custom'}
              label={i18n.t('planner.setup.daysCustom')}
              onPress={() => setDaysPreset('custom')}
            />
            {daysPreset === 'custom' && (
              <>
                <View className="flex-row flex-wrap gap-xs mt-md">
                  {DAY_LABEL_KEYS.map((key, i) => {
                    const active = dayIndexes.includes(i);
                    return (
                      <DayChip
                        key={key}
                        active={active}
                        label={i18n.t(key)}
                        onPress={() => toggleDay(i)}
                      />
                    );
                  })}
                </View>
                <Button
                  variant="primary"
                  onPress={goNextOrFinish}
                  disabled={dayIndexes.length === 0}
                  className="mt-lg"
                  fullWidth
                >
                  {i18n.t('common.continue')}
                </Button>
              </>
            )}
          </StepContainer>
        )}

        {current === 'busy' && (
          <StepContainer
            title={i18n.t('planner.setup.busyTitle')}
            helper={i18n.t('planner.setup.busyHelper')}
          >
            <View className="flex-row flex-wrap gap-xs">
              {DAY_LABEL_KEYS.map((key, i) => {
                const active = busyDays.includes(i);
                return (
                  <DayChip
                    key={key}
                    active={active}
                    label={i18n.t(key)}
                    onPress={() => toggleBusy(i)}
                  />
                );
              })}
            </View>
            <Button
              variant="primary"
              onPress={goNextOrFinish}
              className="mt-lg"
              fullWidth
            >
              {i18n.t('common.continue')}
            </Button>
          </StepContainer>
        )}

        {current === 'mealTypes' && (
          <StepContainer
            title={i18n.t('planner.setup.mealTypesTitle')}
            helper={i18n.t('planner.setup.mealTypesHelper')}
          >
            {getMealTypeOptions(locale).map((opt) => (
              <ChoiceButton
                key={opt.id}
                selected={
                  mealTypes.length === opt.mealTypes.length &&
                  mealTypes.every((m) => opt.mealTypes.includes(m))
                }
                label={i18n.t(opt.labelKey)}
                onPress={() => setMealTypes(opt.mealTypes)}
              />
            ))}
            <Pressable
              onPress={() => setIncludeBeverages((v) => !v)}
              className="mt-md flex-row items-center"
              accessibilityLabel={i18n.t('planner.setup.includeBeverages')}
            >
              <Ionicons
                name={includeBeverages ? 'checkbox' : 'square-outline'}
                size={24}
                color={COLORS.primary.darkest}
              />
              <Text preset="body" className="ml-sm">
                {i18n.t('planner.setup.includeBeverages')}
              </Text>
            </Pressable>
            <Button
              variant="primary"
              onPress={finish}
              loading={submitting}
              disabled={mealTypes.length === 0}
              className="mt-lg"
              style={{ minHeight: 72 }}
              fullWidth
            >
              {i18n.t('planner.setup.letsPlan')}
            </Button>
          </StepContainer>
        )}
      </ScrollView>
    </View>
  );
}

function StepContainer({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text preset="h2" className="mb-sm">
        {title}
      </Text>
      {helper && (
        <Text preset="body" className="text-text-secondary mb-lg">
          {helper}
        </Text>
      )}
      <View className="gap-sm">{children}</View>
    </View>
  );
}

function ChoiceButton({
  selected,
  label,
  onPress,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className={`px-lg py-lg rounded-lg border-2 ${
        selected
          ? 'bg-primary-light border-primary-medium'
          : 'bg-background-secondary border-transparent'
      }`}
      style={{ minHeight: 64 }}
    >
      <Text preset="body" className="text-center">
        {label}
      </Text>
    </Pressable>
  );
}

function DayChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-md py-md rounded-md border-2 ${
        active
          ? 'bg-primary-medium border-primary-medium'
          : 'bg-background-secondary border-transparent'
      }`}
      style={{ minWidth: 64, minHeight: 48 }}
    >
      <Text preset="body" className="text-center">
        {label}
      </Text>
    </Pressable>
  );
}
