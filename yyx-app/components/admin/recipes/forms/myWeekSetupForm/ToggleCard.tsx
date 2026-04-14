import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/common/Text';
import { Switch } from '@/components/common/Switch';

interface ToggleCardProps {
  label: string;
  helper?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

/**
 * ToggleCard — a large, tappable card that wraps a label + helper + switch.
 * The entire card is pressable, not just the switch. Used for boolean planner
 * flags like isCompleteMeal, leftoversFriendly, batchFriendly.
 */
export function ToggleCard({ label, helper, value, onChange }: ToggleCardProps) {
  const toggle = () => onChange(!value);
  const containerClass = value
    ? 'bg-primary-default/30 border-primary-medium'
    : 'bg-primary-lightest border-primary-default';

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      className={`flex-1 flex-row items-start gap-md p-md rounded-lg border ${containerClass} web:hover:border-primary-medium web:transition-colors web:duration-150 web:focus-visible:ring-2 web:focus-visible:ring-primary-medium min-h-[72px]`}
    >
      <View className="flex-1">
        <Text preset="body" className="text-text-default font-semibold">
          {label}
        </Text>
        {helper ? (
          <Text preset="bodySmall" className="text-text-secondary mt-sm">
            {helper}
          </Text>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} />
    </Pressable>
  );
}
