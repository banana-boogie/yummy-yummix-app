import React, { useId, useState } from 'react';
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

/**
 * InfoTooltip — small info-circle icon that toggles an inline panel with
 * helper text. Tap to open, tap icon/outside to close. Cross-platform:
 * web uses an absolutely-positioned inline panel with a transparent backdrop;
 * native uses a transparent Modal anchored at the icon's position.
 */
export function InfoTooltip({
  content,
  accessibilityLabel,
  iconSize = 16,
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const panelId = useId();

  const toggle = () => setOpen((v) => !v);
  const close = () => setOpen(false);

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
      style={[styles.panelShadow, { width: 280 }]}
    >
      <Text preset="bodySmall" className="text-text-default">
        {content}
      </Text>
    </View>
  );

  return (
    <View
      className="relative"
      style={open && isWeb ? styles.openContainer : undefined}
    >
      <Pressable
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

      {open && isWeb ? (
        <>
          {/* Web backdrop — captures outside taps. position:fixed covers the viewport. */}
          <Pressable
            onPress={close}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.webBackdrop}
          />
          <View style={styles.webPanelAnchor} pointerEvents="box-none">
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
    zIndex: 40,
  },
  webPanelAnchor: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 6,
    zIndex: 9999,
  },
  openContainer: {
    zIndex: 9999,
    // Hoist icon+panel above sibling form fields so the panel doesn't
    // render behind inputs that appear later in the DOM.
    ...(Platform.OS === 'web' ? ({ position: 'relative' } as object) : {}),
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
