import React from 'react';
import { Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { COLORS } from '@/constants/design-tokens';

interface VerificationCardProps {
  verifiedAt: string | null;
  verifiedBy: string | null;
  verifiedByDisplay?: string | null;
  displayLocale: string;
  onMarkVerified: () => void;
  onUnverify: () => void;
}

export function VerificationCard({
  verifiedAt,
  verifiedBy,
  verifiedByDisplay,
  displayLocale,
  onMarkVerified,
  onUnverify,
}: VerificationCardProps) {
  const isVerified = !!verifiedAt;

  const nativeShadow = Platform.select({
    ios: {
      shadowColor: COLORS.shadow.default,
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    android: { elevation: 2 },
    default: undefined,
  });

  if (!isVerified) {
    return (
      <View
        className="p-xl rounded-xl bg-white border-2 border-primary-medium shadow-sm web:shadow-md web:transition-[background-color,border-color] web:duration-200"
        style={nativeShadow}
      >
        <View className="flex-row items-start gap-md">
          <Ionicons name="shield-outline" size={28} color={COLORS.text.secondary} />
          <View className="flex-1">
            <Text preset="subheading" className="text-text-default">
              {i18n.t('admin.recipes.form.myWeekSetup.verified.label')}
            </Text>
            <Text preset="bodySmall" className="text-text-secondary mt-xs">
              {i18n.t('admin.recipes.form.myWeekSetup.verified.tooltip')}
            </Text>
            <View className="mt-md self-start">
              <Button
                variant="primary"
                size="small"
                onPress={onMarkVerified}
                label={i18n.t('admin.recipes.form.myWeekSetup.verified.markVerifiedCta')}
              />
            </View>
          </View>
        </View>
      </View>
    );
  }

  const dateStr = new Date(verifiedAt!).toLocaleDateString(
    displayLocale === 'en' ? 'en-US' : 'es-MX',
  );
  const verifiedAtLine = i18n.t('admin.recipes.form.myWeekSetup.verified.verifiedAt', {
    date: dateStr,
  });
  const who = verifiedByDisplay ?? verifiedBy;
  const byLine = who
    ? ' ' + i18n.t('admin.recipes.form.myWeekSetup.verified.verifiedBy', { who })
    : '';

  return (
    <View
      className="p-xl rounded-xl bg-status-success/10 border-2 border-status-success/40 web:transition-[background-color,border-color] web:duration-200"
      style={nativeShadow}
    >
      <View className="flex-row items-start gap-md">
        <Ionicons name="shield-checkmark" size={28} color={COLORS.status.success} />
        <View className="flex-1">
          <Text preset="subheading" className="text-status-success">
            {i18n.t('admin.recipes.form.myWeekSetup.verified.label')}
          </Text>
          <Text preset="caption" className="text-text-secondary mt-xs">
            {verifiedAtLine}
            {byLine}
          </Text>
          <View className="mt-md self-start">
            <Button
              variant="outline"
              size="small"
              onPress={onUnverify}
              label={i18n.t('admin.recipes.form.myWeekSetup.verified.unverifyCta')}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
