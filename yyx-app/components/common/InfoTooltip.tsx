import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  View,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';
import { Text } from '@/components/common/Text';
import { COLORS } from '@/constants/design-tokens';

interface InfoTooltipProps {
  content: string;
  accessibilityLabel?: string;
  iconSize?: number;
}

const isWeb = Platform.OS === 'web';
const PANEL_WIDTH = 240;
const PANEL_MIN_HEIGHT = 96;
const PANEL_GAP = 12;

// Module-level coordinator: only one InfoTooltip may be open at a time across
// the whole app. Opening an instance broadcasts a close to all others.
// Using a tiny pub/sub instead of Context to keep the primitive zero-setup.
type TooltipCloser = () => void;
const openSubscribers = new Set<{ id: string; close: TooltipCloser }>();
function registerTooltip(id: string, close: TooltipCloser) {
  const entry = { id, close };
  openSubscribers.add(entry);
  return () => {
    openSubscribers.delete(entry);
  };
}
function broadcastOpen(id: string) {
  openSubscribers.forEach((entry) => {
    if (entry.id !== id) entry.close();
  });
}

/**
 * InfoTooltip — small info-circle icon that toggles a panel with helper text.
 * Tap to open, tap icon or outside to close.
 *
 * Web: panel renders at `position: fixed` with coordinates computed from the
 * icon's bounding rect. This bypasses stacking-context issues entirely — the
 * panel lives outside any parent's overflow/z-index/transform boundaries.
 *
 * Native: transparent Modal with a centered panel (Modals already render above
 * everything by default).
 */
export function InfoTooltip({
  content,
  accessibilityLabel,
  iconSize = 16,
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const iconRef = useRef<View>(null);
  const panelId = useId();

  const close = React.useCallback(() => setOpen(false), []);

  // Register with the module coordinator so other tooltips can close us.
  useEffect(() => {
    const unregister = registerTooltip(panelId, close);
    return unregister;
  }, [panelId, close]);

  const toggle = (event?: unknown) => {
    const maybeEvent = event as { stopPropagation?: () => void } | undefined;
    maybeEvent?.stopPropagation?.();
    setOpen((v) => {
      const next = !v;
      if (next) broadcastOpen(panelId);
      return next;
    });
  };

  // Recompute panel coords whenever it opens and on resize/scroll while open.
  useLayoutEffect(() => {
    if (!open || !isWeb) return;

    const measure = () => {
      const node = iconRef.current as unknown as HTMLElement | null;
      if (!node || typeof node.getBoundingClientRect !== 'function') return;
      const rect = node.getBoundingClientRect();
      const viewportWidth =
        typeof window !== 'undefined' ? window.innerWidth : 0;
      const viewportHeight =
        typeof window !== 'undefined' ? window.innerHeight : 0;
      const topAligned = Math.max(
        8,
        Math.min(rect.top - 10, viewportHeight - PANEL_MIN_HEIGHT - 8),
      );

      if (rect.right + PANEL_GAP + PANEL_WIDTH <= viewportWidth - 8) {
        setCoords({ top: topAligned, left: rect.right + PANEL_GAP });
        return;
      }

      if (rect.left - PANEL_GAP - PANEL_WIDTH >= 8) {
        setCoords({ top: topAligned, left: rect.left - PANEL_GAP - PANEL_WIDTH });
        return;
      }

      const leftCentered = rect.left + rect.width / 2 - PANEL_WIDTH / 2;
      const leftClamped = Math.max(
        8,
        Math.min(leftCentered, viewportWidth - PANEL_WIDTH - 8),
      );
      setCoords({ top: rect.bottom + 6, left: leftClamped });
    };

    measure();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure);
      window.addEventListener('scroll', measure, true);
      return () => {
        window.removeEventListener('resize', measure);
        window.removeEventListener('scroll', measure, true);
      };
    }
    return undefined;
  }, [open]);

  // Close on Escape (web only).
  useEffect(() => {
    if (!open || !isWeb) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    return undefined;
  }, [open]);

  const iconColor = open
    ? COLORS.primary.dark
    : hovered
      ? COLORS.primary.medium
      : COLORS.grey.medium_dark;

  const label = accessibilityLabel ?? i18n.t('common.moreInfo');

  const webAria = isWeb
    ? ({
        'aria-describedby': open ? panelId : undefined,
        'aria-expanded': open,
      } as Record<string, unknown>)
    : {};

  const panel = (
    <View
      nativeID={isWeb ? panelId : undefined}
      accessibilityLiveRegion={!isWeb ? 'polite' : undefined}
      className="bg-neutral-white rounded-md border border-grey-default p-sm"
      style={[styles.panelShadow, { width: PANEL_WIDTH }]}
    >
      <Text preset="bodySmall" className="text-text-default">
        {content}
      </Text>
    </View>
  );

  return (
    <View className="relative">
      <Pressable
        ref={iconRef}
        onPress={toggle}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        {...webAria}
      >
        <Ionicons
          name="information-circle-outline"
          size={iconSize}
          color={iconColor}
        />
      </Pressable>

      {open && isWeb && coords ? (
        <>
          {/* Fixed-position backdrop captures outside taps above all content. */}
          <Pressable
            onPress={close}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.webBackdrop}
          />
          {/* Panel lives at position:fixed with computed coords; outside any
              parent stacking context / overflow boundary. */}
          <View style={[styles.webPanelFixed, { top: coords.top, left: coords.left }]}>
            {panel}
          </View>
        </>
      ) : null}

      {open && !isWeb ? (
        <Modal transparent animationType="fade" onRequestClose={close}>
          <Pressable onPress={close} style={styles.nativeBackdrop}>
            <View style={styles.nativePanelWrap} pointerEvents="box-none">
              <Pressable
                // Prevent backdrop dismiss when tapping inside panel.
                onPress={(e) => {
                  const anyEvt = e as unknown as { stopPropagation?: () => void };
                  anyEvt.stopPropagation?.();
                }}
              >
                {panel}
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panelShadow: Platform.select({
    web: {
      boxShadow: '0 1px 2px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.06)',
    } as object,
    default: {
      elevation: 4,
      shadowColor: COLORS.shadow.default,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
    },
  }) as object,
  webBackdrop: {
    position: 'fixed' as unknown as 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    // Transparent backdrop — its only job is click-outside-to-close.
  },
  webPanelFixed: {
    position: 'fixed' as unknown as 'absolute',
    zIndex: 1000,
  },
  nativeBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  nativePanelWrap: {
    maxWidth: 320,
    width: '100%',
  },
});
