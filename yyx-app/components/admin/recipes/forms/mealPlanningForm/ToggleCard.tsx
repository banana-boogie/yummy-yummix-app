import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/common/Text';
import { Switch } from '@/components/common/Switch';
import { InfoTooltip } from '@/components/common/InfoTooltip';

interface ToggleCardProps {
  label: string;
  helper?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

/**
 * ToggleCard — a large, tappable card that wraps a label + optional info
 * tooltip + switch. The entire card is pressable, not just the switch. Used
 * for boolean planner flags like isCompleteMeal, leftoversFriendly, batchFriendly.
 */
export function ToggleCard({ label, helper, value, onChange }: ToggleCardProps) {
  const toggle = () => onChange(!value);
  const containerClass = value
    ? 'bg-neutral-white border-[1.5px] border-primary-medium'
    : 'bg-neutral-white border border-grey-default web:hover:border-grey-medium_dark';

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      className={`flex-1 flex-row items-center gap-md p-md rounded-lg ${containerClass} web:transition-colors web:duration-150 web:focus-visible:ring-2 web:focus-visible:ring-primary-default min-h-[72px]`}
    >
      {value ? (
        <View className="w-1 bg-primary-dark rounded-full self-stretch" />
      ) : null}
      <View className="flex-1 flex-row items-center gap-xs">
        <Text
          preset="body"
          className={`flex-shrink text-text-default ${value ? 'font-semibold' : ''}`}
        >
          {label}
        </Text>
        {helper ? <InfoTooltip content={helper} /> : null}
      </View>
      <Switch value={value} onValueChange={onChange} />
    </Pressable>
  );
}
