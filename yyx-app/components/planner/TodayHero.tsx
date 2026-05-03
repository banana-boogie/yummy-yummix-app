/**
 * TodayHero — primary surface for the Mi Menú tab.
 *
 * Renders one of six internal variants for "today's pick":
 *   - activePlanned   (canonical hero with "Cocinar esto" + "Cambiar")
 *   - draftPlanned    (plan generated, not yet approved — hint replaces CTA)
 *   - cooked          (this slot is cooked; only reachable as a tiebreaker —
 *                      typically the all-cooked-today path drives this)
 *   - noUncookedToday (every slot today is cooked; cooked render + handwritten
 *                      footer)
 *   - skipped         (slot was skipped; muted card, outline-promoted Cambiar)
 *   - noSlotToday     (no slot for today's dayIndex / plannedDate; covers
 *                      stale-plan case too)
 *
 * See `docs/planner/hoy-en-tu-menu-design.md` and
 * `docs/planner/hoy-en-tu-menu-plan.md` for the full contract.
 */

import React, {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PixelRatio,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';
import { Button, Text } from '@/components/common';
import { COLORS } from '@/constants/design-tokens';
import { useLanguage } from '@/contexts/LanguageContext';
import i18n from '@/i18n';
import { selectPrimarySlot } from './utils/selectPrimarySlot';
import { SwapMealSheet } from './SwapMealSheet';
import { eventService } from '@/services/eventService';
import type {
  MealPlanResponse,
  MealPlanSlotResponse,
  PreferencesResponse,
  SwapMealResponse,
} from '@/types/mealPlan';

export type TodayHeroVariant =
  | 'activePlanned'
  | 'draftPlanned'
  | 'cooked'
  | 'noUncookedToday'
  | 'skipped'
  | 'noSlotToday'
  /**
   * Internal variant: the slot is `planned`, plan is approved, but the primary
   * component's recipeId is missing/null (e.g., recipe was deleted server-side).
   * Renders like activePlanned but swaps the cook CTA for a "recipe unavailable"
   * notice. Tracked in analytics so we can spot orphaned-slot regressions.
   */
  | 'recipeUnavailable';

interface TodayHeroProps {
  plan: MealPlanResponse;
  todaysSlots: MealPlanSlotResponse[];
  preferences: PreferencesResponse | null;
  /** Pull-to-refresh handler. */
  onRefresh: () => void | Promise<void>;
  isRefreshing: boolean;
  /** Toggle the parent MenuScreen into week mode. */
  onSeeWeek: () => void;
  /** Swap mutation; returns alternatives. Sheet calls this on open. */
  onSwap: (slotId: string, reason?: string) => Promise<SwapMealResponse>;
  /** Apply a chosen alternative to the slot. Called when the user picks one. */
  onApplySwap: (slotId: string, recipeId: string) => Promise<SwapMealResponse>;
}

export const TodayHero = forwardRef<View, TodayHeroProps>(function TodayHero(
  {
    plan,
    todaysSlots,
    preferences,
    onRefresh,
    isRefreshing,
    onSeeWeek,
    onSwap,
    onApplySwap,
  }: TodayHeroProps,
  ref,
) {
  const { language, locale } = useLanguage();

  // Memoize selector output by slot id so downstream effects don't fire on
  // identity-only re-renders. The selector is pure but allocates on every call.
  const slot = useMemo(
    () => selectPrimarySlot(todaysSlots, preferences, locale),
    [todaysSlots, preferences, locale],
  );

  // Derive `canCook` early — guards Cocinar esto / View again against deleted
  // recipes (Lupita-readiness fail otherwise). See plan §F1.
  const primaryComponent = useMemo(() => {
    if (!slot) return null;
    return slot.components.find((c) => c.isPrimary) ?? slot.components[0] ?? null;
  }, [slot]);
  const canCook = !!primaryComponent?.recipeId;

  const variant = useMemo<TodayHeroVariant>(() => {
    if (todaysSlots.length === 0 || slot == null) return 'noSlotToday';
    if (slot.status === 'skipped') return 'skipped';
    if (slot.status === 'cooked') {
      const allCooked = todaysSlots.every((s) => s.status === 'cooked');
      return allCooked ? 'noUncookedToday' : 'cooked';
    }
    // status === 'planned'
    if (plan.shoppingListId == null) return 'draftPlanned';
    if (!canCook) return 'recipeUnavailable';
    return 'activePlanned';
  }, [todaysSlots, slot, plan.shoppingListId, canCook]);

  // Fire variant-render analytics once per variant change.
  useEffect(() => {
    eventService.logPlannerTodayView({ variant });
  }, [variant]);

  // ---- Pull-to-refresh ----
  const handleRefresh = () => {
    eventService.logPlannerPullToRefresh();
    onRefresh();
  };

  // ---- Swap sheet ----
  const [swapVisible, setSwapVisible] = useState(false);
  const handleOpenSwap = () => {
    if (!slot) return;
    eventService.logPlannerSwapPress({ slotId: slot.id });
    setSwapVisible(true);
  };
  const handlePickAlternative = ({
    newRecipeId,
  }: {
    slotId: string;
    newRecipeId: string | null;
  }) => {
    if (!slot) return;
    eventService.logPlannerSwapComplete({
      slotId: slot.id,
      newRecipeId,
    });
    if (newRecipeId) {
      // Fire-and-forget: server applies the swap, plan invalidates and
      // refetches automatically via the mutation's onSuccess. Errors swallowed
      // here surface in the next plan refetch as stale data; not user-blocking.
      onApplySwap(slot.id, newRecipeId).catch(() => {});
    }
  };

  // ---- Cook navigation ----
  const handleCook = () => {
    if (!slot) return;
    const primary =
      slot.components.find((c) => c.isPrimary) ?? slot.components[0];
    if (!primary?.recipeId) return;
    eventService.logPlannerCookPress({
      slotId: slot.id,
      recipeId: primary.recipeId,
    });
    router.push(`/recipes/${primary.recipeId}` as never);
  };

  const handleViewRecipeAgain = () => {
    if (!slot) return;
    if (primaryComponent?.recipeId)
      router.push(`/recipes/${primaryComponent.recipeId}` as never);
  };

  // Card-level tap (image + title): navigate to recipe detail when a recipe
  // is available. Distinct from "Cook this" only in analytics intent.
  const handleViewRecipe = () => {
    if (primaryComponent?.recipeId) {
      router.push(`/recipes/${primaryComponent.recipeId}` as never);
    }
  };

  // ---- Date heading ----
  const dateLocale = language === 'es' ? esLocale : enUS;
  const dateLabel = format(new Date(), 'EEEE d MMM', { locale: dateLocale });

  const refreshControl =
    Platform.OS !== 'web' ? (
      <RefreshControl
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        tintColor={COLORS.primary.darkest}
        colors={[COLORS.primary.darkest]}
        progressBackgroundColor={COLORS.primary.lightest}
      />
    ) : undefined;

  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 }}
        refreshControl={refreshControl}
      >
        {/* Inner wrapper anchors a11y focus when toggling from week→today. */}
        <View ref={ref} accessible>
        {/* Heading */}
        {variant !== 'noSlotToday' && (
          <View className="mt-md mb-md">
            <Text preset="h2">{i18n.t('planner.today.heading')}</Text>
            <Text preset="caption" className="text-text-secondary mt-xxs">
              {dateLabel}
            </Text>
          </View>
        )}

        {variant === 'noSlotToday' ? (
          <NoSlotTodayBlock onSeeWeek={onSeeWeek} />
        ) : (
          slot && (
            <HeroCard
              variant={variant}
              slot={slot}
              canCook={canCook}
              onCook={handleCook}
              onSwap={handleOpenSwap}
              onSeeMyMenu={onSeeWeek}
              onViewRecipeAgain={handleViewRecipeAgain}
              onPressCard={
                primaryComponent?.recipeId ? handleViewRecipe : null
              }
            />
          )
        )}

        {/* Standalone week link — omitted in noSlotToday variant per design §2.5. */}
        {variant !== 'noSlotToday' && (
          <View className="items-center mt-xl">
            <Pressable
              onPress={() => {
                eventService.logPlannerWeekLinkPress();
                onSeeWeek();
              }}
              accessibilityRole="button"
              // Drop the "→" glyph from the screen-reader label per design §7
              // (avoid VoiceOver announcing "right arrow").
              accessibilityLabel={i18n
                .t('planner.today.seeWeek')
                .replace('→', '')
                .trim()}
              hitSlop={8}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text preset="link">{i18n.t('planner.today.seeWeek')}</Text>
            </Pressable>
          </View>
        )}
        </View>
      </ScrollView>

      <SwapMealSheet
        visible={swapVisible}
        slot={slot}
        onSwap={(reason) =>
          slot
            ? onSwap(slot.id, reason)
            : Promise.resolve({ alternatives: [], warnings: [] })
        }
        onClose={() => setSwapVisible(false)}
        onPickAlternative={handlePickAlternative}
      />
    </>
  );
});

// =============================================================================
// HeroCard — variants that render as a card
// =============================================================================

interface HeroCardProps {
  variant: Exclude<TodayHeroVariant, 'noSlotToday'>;
  slot: MealPlanSlotResponse;
  canCook: boolean;
  onCook: () => void;
  onSwap: () => void;
  onSeeMyMenu: () => void;
  onViewRecipeAgain: () => void;
  onPressCard: (() => void) | null;
}

function HeroCard({
  variant,
  slot,
  canCook,
  onCook,
  onSwap,
  onSeeMyMenu,
  onViewRecipeAgain,
  onPressCard,
}: HeroCardProps) {
  const primary =
    slot.components.find((c) => c.isPrimary) ?? slot.components[0];
  const title = primary?.title ?? i18n.t('planner.card.untitled');
  const isCookedVariant = variant === 'cooked' || variant === 'noUncookedToday';
  const isSkipped = variant === 'skipped';

  // Per design §7: allow up to 3 lines of recipe title at scaled fonts (≥1.3×)
  // before clipping. At default scale we keep 2 to preserve hero rhythm.
  const fontScale = PixelRatio.getFontScale();
  const titleLines = fontScale >= 1.3 ? 3 : 2;

  const meta: string[] = [];
  if (primary?.portions != null) {
    meta.push(i18n.t('planner.card.portions', { n: primary.portions }));
  }
  if (primary?.totalTimeMinutes != null) {
    meta.push(i18n.t('planner.card.minutes', { n: primary.totalTimeMinutes }));
  }
  if (primary?.equipmentTags?.includes('thermomix')) {
    meta.push('Thermomix');
  }

  return (
    <View
      className="bg-neutral-white rounded-xl overflow-hidden"
      style={{
        // Inline shadow until a token exists. Per design §3 / §8 (decision 9).
        shadowColor: COLORS.neutral.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <Pressable
        onPress={onPressCard ?? undefined}
        disabled={!onPressCard}
        accessibilityRole={onPressCard ? 'button' : undefined}
        accessibilityLabel={onPressCard ? title : undefined}
      >
        <PhotoBlock
          imageUrl={primary?.imageUrl ?? null}
          title={title}
          cooked={isCookedVariant}
          skipped={isSkipped}
        />
      </Pressable>

      <View className="px-lg pt-md pb-lg">
        {isCookedVariant && (
          <Text
            preset="bodySmall"
            className="text-status-success uppercase mb-xxs"
            fontWeight="semibold"
            style={{ letterSpacing: 0.5 }}
          >
            {i18n.t('planner.today.cookedToday')}
          </Text>
        )}

        <Pressable
          onPress={onPressCard ?? undefined}
          disabled={!onPressCard}
          accessibilityRole={onPressCard ? 'button' : undefined}
          accessibilityLabel={onPressCard ? title : undefined}
        >
          <Text
            preset="h2"
            numberOfLines={titleLines}
            style={isSkipped ? { opacity: 0.6 } : undefined}
          >
            {title}
          </Text>

          {meta.length > 0 && !isCookedVariant && (
            // numberOfLines={1} keeps the meta row from wrapping. Custom Text
            // doesn't pass through adjustsFontSizeToFit; at very large font
            // scales the meta will truncate with an ellipsis. Acceptable per
            // design §7 — caller is the canonical Text component.
            <Text
              preset="bodySmall"
              className="mt-xxs text-text-default"
              numberOfLines={1}
              style={isSkipped ? { opacity: 0.6 } : undefined}
            >
              {meta.join(' · ')}
            </Text>
          )}
        </Pressable>

        {/* --- Action area: variant-specific --- */}
        {variant === 'activePlanned' && (
          <>
            <View className="mt-lg">
              {/*
                NOTE: Button does not currently expose adjustsFontSizeToFit on its
                inner Text. At very large font scales (>=1.5x) on narrow devices
                the CTA copy may clip. Tracked as a follow-up to extend Button
                rather than rebuild it here. See design §7.
              */}
              <Button
                variant="primary"
                size="large"
                onPress={onCook}
                fullWidth
                style={{ minHeight: 72 }}
                accessibilityLabel={i18n.t('planner.today.cookThis')}
              >
                {i18n.t('planner.today.cookThis')}
              </Button>
            </View>
            <ChangeTextButton onPress={onSwap} />
          </>
        )}

        {variant === 'recipeUnavailable' && (
          <>
            <View className="bg-grey-light rounded-md p-md mt-lg">
              <Text preset="bodySmall" className="text-text-secondary">
                {i18n.t('planner.today.recipeUnavailable')}
              </Text>
            </View>
            <View className="mt-lg">
              <Button
                variant="outline"
                size="large"
                onPress={onSwap}
                fullWidth
                style={{ minHeight: 72 }}
                accessibilityLabel={i18n.t('planner.today.change')}
              >
                {i18n.t('planner.today.change')}
              </Button>
            </View>
          </>
        )}

        {variant === 'draftPlanned' && (
          <>
            <View className="bg-primary-light rounded-md p-md mt-lg flex-row items-start">
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={COLORS.primary.darkest}
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <View className="flex-1">
                <Text preset="bodySmall" className="text-text-default">
                  {i18n.t('planner.today.approveFirstHint')}
                </Text>
                <Pressable
                  onPress={onSeeMyMenu}
                  accessibilityRole="button"
                  accessibilityLabel={i18n.t('planner.today.seeMyMenu')}
                  hitSlop={8}
                  style={{ minHeight: 32, justifyContent: 'center' }}
                >
                  <Text preset="link" className="text-primary-darkest mt-xs">
                    {i18n.t('planner.today.seeMyMenu')}
                  </Text>
                </Pressable>
              </View>
            </View>
            <ChangeTextButton onPress={onSwap} />
          </>
        )}

        {variant === 'skipped' && (
          <>
            <View className="bg-grey-light rounded-md p-md mt-lg">
              <Text preset="bodySmall" className="text-text-secondary">
                {i18n.t('planner.today.skippedNotice')}
              </Text>
            </View>
            <View className="mt-lg">
              <Button
                variant="outline"
                size="large"
                onPress={onSwap}
                fullWidth
                style={{ minHeight: 72 }}
                accessibilityLabel={i18n.t('planner.today.change')}
              >
                {i18n.t('planner.today.change')}
              </Button>
            </View>
          </>
        )}

        {(variant === 'cooked' || variant === 'noUncookedToday') && canCook && (
          <Pressable
            onPress={onViewRecipeAgain}
            accessibilityRole="link"
            accessibilityLabel={i18n.t('planner.today.viewRecipeAgain')}
            className="items-center py-md mt-md"
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text preset="link">
              {i18n.t('planner.today.viewRecipeAgain')}
            </Text>
          </Pressable>
        )}

        {variant === 'noUncookedToday' && (
          <View
            className="border-t border-grey-default pt-md mt-md items-center"
          >
            <Text
              preset="handwritten"
              className="text-primary-darkest"
            >
              {i18n.t('planner.today.greatJobToday')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ChangeTextButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={i18n.t('planner.today.change')}
      className="items-center"
      style={{ minHeight: 44, justifyContent: 'center', marginTop: 12 }}
    >
      <Text preset="body" className="text-primary-darkest">
        {i18n.t('planner.today.change')}
      </Text>
    </Pressable>
  );
}

// =============================================================================
// PhotoBlock
// =============================================================================

interface PhotoBlockProps {
  imageUrl: string | null;
  title: string;
  cooked: boolean;
  skipped: boolean;
}

function PhotoBlock({ imageUrl, title, cooked, skipped }: PhotoBlockProps) {
  return (
    <View
      className="bg-grey-light"
      style={{
        aspectRatio: 4 / 3,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        opacity: skipped ? 0.5 : 1,
      }}
    >
      {imageUrl && (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          accessibilityLabel={title}
        />
      )}
      {cooked && (
        <>
          {/*
            Layered cooked treatment: 35% white overlay. True saturation
            adjustment is not portably available on RN's expo-image (tintColor
            doesn't desaturate) — the white overlay alone reads as "this
            happened, it's done." Documented deviation from design §6 (which
            calls for 0.6 saturation in addition).
          */}
          <View
            pointerEvents="none"
            style={{
              ...{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
              },
              backgroundColor: COLORS.neutral.white,
              opacity: 0.35,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: COLORS.status.success,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessible
            accessibilityLabel={i18n.t('planner.today.cookedToday')}
          >
            <Ionicons name="checkmark" size={16} color={COLORS.neutral.white} />
          </View>
        </>
      )}
    </View>
  );
}

// =============================================================================
// noSlotToday block
// =============================================================================

function NoSlotTodayBlock({ onSeeWeek }: { onSeeWeek: () => void }) {
  return (
    <View className="flex-1 items-center justify-center px-lg py-xl">
      <Image
        source={require('@/assets/images/irmixy-avatar/irmixy-face.png')}
        style={{ width: 96, height: 96, borderRadius: 48 }}
        contentFit="cover"
      />
      <Text preset="h3" className="text-center mt-lg mb-lg">
        {i18n.t('planner.today.nothingPlanned')}
      </Text>
      <View className="w-full max-w-sm">
        <Button
          variant="primary"
          size="large"
          onPress={() => {
            eventService.logPlannerWeekLinkPress();
            onSeeWeek();
          }}
          fullWidth
          style={{ minHeight: 72 }}
          accessibilityLabel={i18n.t('planner.today.seeWeek')}
        >
          {i18n.t('planner.today.seeWeek')}
        </Button>
      </View>
    </View>
  );
}

// =============================================================================
// Loading skeleton
// =============================================================================

export function TodayHeroSkeleton() {
  const opacity = useRef(new Animated.Value(0.7)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => {
        if (!cancelled) setReduceMotion(!!v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (v) => setReduceMotion(!!v),
    );
    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.7);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, opacity]);

  return (
    <View className="px-lg" style={{ flex: 1 }}>
      <Animated.View style={{ opacity }}>
        <View className="mt-md mb-md">
          <View
            className="bg-grey-light rounded-sm"
            style={{ width: '60%', height: 24 }}
          />
          <View
            className="bg-grey-light rounded-sm mt-xs"
            style={{ width: '30%', height: 16 }}
          />
        </View>
        <View
          className="bg-neutral-white rounded-xl overflow-hidden"
          style={{
            shadowColor: COLORS.neutral.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View
            className="bg-grey-light"
            style={{
              aspectRatio: 4 / 3,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
          />
          <View className="p-lg">
            <View
              className="bg-grey-light rounded-md"
              style={{ width: '70%', height: 24 }}
            />
            <View
              className="bg-grey-light rounded-sm mt-sm"
              style={{ width: '50%', height: 16 }}
            />
            <View
              className="bg-grey-light rounded-xl mt-lg"
              style={{ height: 72 }}
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// =============================================================================
// Error variant — rendered by parent orchestrator on planQuery.error
// =============================================================================

export function TodayHeroError({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="px-lg flex-1 justify-center">
      <View className="bg-primary-lighter rounded-lg p-lg">
        <View className="flex-row items-center mb-sm">
          <Ionicons
            name="alert-circle"
            size={24}
            color={COLORS.status.error}
            style={{ marginRight: 8 }}
          />
          <Text preset="body" fontWeight="semibold">
            {i18n.t('planner.today.loadError')}
          </Text>
        </View>
        <Text
          preset="bodySmall"
          className="text-text-secondary mb-md"
        >
          {i18n.t('planner.today.loadErrorHint')}
        </Text>
        <Button
          variant="outline"
          size="medium"
          onPress={onRetry}
          fullWidth
          accessibilityLabel={i18n.t('planner.today.retry')}
        >
          {i18n.t('planner.today.retry')}
        </Button>
      </View>
    </View>
  );
}
