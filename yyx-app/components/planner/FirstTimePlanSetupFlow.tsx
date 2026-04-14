/**
 * First-time meal plan setup — full-height guided flow.
 *
 * One question per step, auto-advance on selection. Collects household size,
 * days to plan, busy days, and meal types. Returns the collected answers via
 * `onComplete` so the parent can call generatePlan() and/or persist
 * preferences.
 *
 * The nutrition step is intentionally deferred until the FEATURE_NUTRITION_GOALS
 * flag is plumbed through; the component today ships a 4-step flow.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button } from '@/components/common';
import { useLanguage } from '@/contexts/LanguageContext';
import i18n from '@/i18n';
import { COLORS } from '@/constants/design-tokens';
import type {
  GeneratePlanOptions,
  PreferencesResponse,
} from '@/types/mealPlan';

interface FirstTimePlanSetupFlowProps {
  initialPreferences?: PreferencesResponse;
  onCancel: () => void;
  onComplete: (answers: GeneratePlanOptions) => Promise<void> | void;
}

type HouseholdSize = 'solo' | 'two' | 'family_small' | 'family_large';
type DaysPreset = 'weekdays' | 'every_day' | 'custom';

const WEEKDAY_INDEXES = [0, 1, 2, 3, 4];
const EVERY_DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6];

function isMexicanSpanish(locale: string): boolean {
  const l = locale.toLowerCase();
  return l.startsWith('es');
}

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

function getMealTypeOptions(localeIsES: boolean): MealTypeOption[] {
  // In es-MX, the midday meal ("comida") takes the role of lunch.
  // We still send canonical meal types to the server; the label is localized.
  const lunchLabel = localeIsES
    ? 'planner.mealTypes.comidaOnly'
    : 'planner.mealTypes.dinnersOnly';
  const comboLabel = localeIsES
    ? 'planner.mealTypes.comidaAndDinner'
    : 'planner.mealTypes.lunchAndDinner';
  return [
    { id: 'dinner', mealTypes: ['dinner'], labelKey: lunchLabel },
    { id: 'lunch_dinner', mealTypes: ['lunch', 'dinner'], labelKey: comboLabel },
    {
      id: 'breakfast_lunch_dinner',
      mealTypes: ['breakfast', 'lunch', 'dinner'],
      labelKey: 'planner.mealTypes.allThree',
    },
  ];
}

const HOUSEHOLD_OPTIONS: { id: HouseholdSize; labelKey: string }[] = [
  { id: 'solo', labelKey: 'planner.household.solo' },
  { id: 'two', labelKey: 'planner.household.two' },
  { id: 'family_small', labelKey: 'planner.household.familySmall' },
  { id: 'family_large', labelKey: 'planner.household.familyLarge' },
];

export function FirstTimePlanSetupFlow({
  initialPreferences,
  onCancel,
  onComplete,
}: FirstTimePlanSetupFlowProps) {
  const { locale } = useLanguage();
  const isES = isMexicanSpanish(locale);

  // Skip steps that already have saved data, except household size (always shown).
  const hasSavedDays = !!initialPreferences?.activeDayIndexes?.length;
  const hasSavedBusy = !!initialPreferences?.busyDays?.length;
  const hasSavedMealTypes = !!initialPreferences?.mealTypes?.length;

  const steps = useMemo(
    () => {
      const all: ('household' | 'days' | 'busy' | 'mealTypes')[] = [
        'household',
      ];
      if (!hasSavedDays) all.push('days');
      if (!hasSavedBusy) all.push('busy');
      if (!hasSavedMealTypes) all.push('mealTypes');
      return all;
    },
    [hasSavedDays, hasSavedBusy, hasSavedMealTypes],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [household, setHousehold] = useState<HouseholdSize | null>(null);
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

  const next = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, steps.length));
  }, [steps.length]);

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

  const finish = useCallback(async () => {
    setSubmitting(true);
    try {
      const finalMealTypes = includeBeverages
        ? [...mealTypes, 'beverage']
        : mealTypes;
      await onComplete({
        dayIndexes: dayIndexes.length ? dayIndexes : WEEKDAY_INDEXES,
        mealTypes: finalMealTypes.length ? finalMealTypes : ['dinner'],
        busyDays,
      });
    } finally {
      setSubmitting(false);
    }
  }, [dayIndexes, mealTypes, busyDays, includeBeverages, onComplete]);

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
        {current === 'household' && (
          <StepContainer
            title={i18n.t('planner.setup.householdTitle')}
            helper={i18n.t('planner.setup.householdHelper')}
          >
            {HOUSEHOLD_OPTIONS.map((opt) => (
              <ChoiceButton
                key={opt.id}
                selected={household === opt.id}
                label={i18n.t(opt.labelKey)}
                onPress={() => {
                  setHousehold(opt.id);
                  next();
                }}
              />
            ))}
          </StepContainer>
        )}

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
                next();
              }}
            />
            <ChoiceButton
              selected={daysPreset === 'every_day'}
              label={i18n.t('planner.setup.daysEveryDay')}
              onPress={() => {
                setDaysPreset('every_day');
                setDayIndexes(EVERY_DAY_INDEXES);
                next();
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
                  onPress={next}
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
              onPress={next}
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
            {getMealTypeOptions(isES).map((opt) => (
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
