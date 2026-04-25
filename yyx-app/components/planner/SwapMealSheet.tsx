/**
 * Bottom-sheet-style modal for swapping a meal slot.
 *
 * v1 contract: open → call `onSwap()` (which fetches alternatives via the
 * server's `swap_meal` action) → display up to 3 alternatives. Tapping an
 * alternative closes the sheet; the server-side commit-to-chosen-alternative
 * round-trip does not yet exist, so the next plan refetch (queued by
 * `useMealPlan.swapMutation`'s `onSuccess: invalidatePlan`) reflects whatever
 * the server selected.
 *
 * Built with RN's built-in `Modal` to avoid pulling in reanimated /
 * gesture-handler. Slide animation is handled natively.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/common';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
import type {
  MealPlanSlotResponse,
  SwapAlternative,
  SwapMealResponse,
} from '@/types/mealPlan';

interface SwapMealSheetProps {
  visible: boolean;
  slot: MealPlanSlotResponse | null;
  onSwap: (reason?: string) => Promise<SwapMealResponse>;
  onClose: () => void;
  /** Called with the chosen alternative slot ID for analytics; sheet closes regardless. */
  onPickAlternative?: (newSlotId: string) => void;
}

type SheetState =
  | { phase: 'loading' }
  | { phase: 'loaded'; alternatives: SwapAlternative[] }
  | { phase: 'error' };

export function SwapMealSheet({
  visible,
  slot,
  onSwap,
  onClose,
  onPickAlternative,
}: SwapMealSheetProps) {
  const [state, setState] = useState<SheetState>({ phase: 'loading' });

  useEffect(() => {
    if (!visible || !slot) return;
    let cancelled = false;
    setState({ phase: 'loading' });
    onSwap()
      .then((res) => {
        if (cancelled) return;
        setState({ phase: 'loaded', alternatives: res.alternatives ?? [] });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ phase: 'error' });
      });
    return () => {
      cancelled = true;
    };
    // We intentionally re-run when visibility/slot change — not when onSwap
    // identity changes (parents commonly inline-bind it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, slot?.id]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        accessibilityLabel={i18n.t('planner.today.closeSwap')}
        className="flex-1 bg-neutral-black/50 justify-end"
      >
        {/* Inner Pressable swallows taps so tapping the sheet doesn't dismiss. */}
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View
            className="bg-neutral-white rounded-t-xl px-lg pt-lg pb-xl"
            style={{ maxHeight: '80%' }}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between mb-md">
              <Text preset="h3">{i18n.t('planner.today.swapTitle')}</Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={i18n.t('planner.today.closeSwap')}
                hitSlop={12}
                style={{ minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={COLORS.text.default}
                />
              </Pressable>
            </View>

            {state.phase === 'loading' && (
              <View className="items-center py-xl">
                <ActivityIndicator color={COLORS.primary.darkest} />
                <Text
                  preset="bodySmall"
                  className="text-text-secondary mt-md"
                >
                  {i18n.t('planner.today.swapLoading')}
                </Text>
              </View>
            )}

            {state.phase === 'error' && (
              <View className="items-center py-xl">
                <Text
                  preset="bodySmall"
                  className="text-text-secondary text-center"
                >
                  {i18n.t('planner.today.swapEmpty')}
                </Text>
              </View>
            )}

            {state.phase === 'loaded' && state.alternatives.length === 0 && (
              <View className="items-center py-xl">
                <Text
                  preset="bodySmall"
                  className="text-text-secondary text-center"
                >
                  {i18n.t('planner.today.swapEmpty')}
                </Text>
              </View>
            )}

            {state.phase === 'loaded' && state.alternatives.length > 0 && (
              <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
                <View className="gap-sm">
                  {state.alternatives.slice(0, 3).map((alt) => (
                    <AlternativeRow
                      key={alt.slot.id}
                      alternative={alt}
                      onPick={() => {
                        onPickAlternative?.(alt.slot.id);
                        onClose();
                      }}
                    />
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface AlternativeRowProps {
  alternative: SwapAlternative;
  onPick: () => void;
}

function AlternativeRow({ alternative, onPick }: AlternativeRowProps) {
  const primary =
    alternative.slot.components.find((c) => c.isPrimary) ??
    alternative.slot.components[0];
  const title = primary?.title ?? i18n.t('planner.card.untitled');
  const meta: string[] = [];
  if (primary?.totalTimeMinutes != null) {
    meta.push(i18n.t('planner.card.minutes', { n: primary.totalTimeMinutes }));
  }
  if (primary?.portions != null) {
    meta.push(i18n.t('planner.card.portions', { n: primary.portions }));
  }

  return (
    <Pressable
      onPress={onPick}
      accessibilityRole="button"
      accessibilityLabel={title}
      className="flex-row items-center bg-primary-lightest rounded-md p-md"
      style={{ minHeight: 56 }}
    >
      {primary?.imageUrl ? (
        <Image
          source={{ uri: primary.imageUrl }}
          style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            backgroundColor: COLORS.grey.light,
          }}
          contentFit="cover"
        />
      ) : (
        <View
          className="bg-grey-light rounded-md"
          style={{ width: 64, height: 64 }}
        />
      )}
      <View className="flex-1 ml-md">
        <Text preset="body" numberOfLines={2}>
          {title}
        </Text>
        {meta.length > 0 && (
          <Text preset="caption" className="text-text-secondary mt-xxs">
            {meta.join(' · ')}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
