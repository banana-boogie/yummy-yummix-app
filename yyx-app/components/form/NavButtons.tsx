import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/common/Button';

interface NavButtonsProps {
  onNext?: () => void;
  onPrev?: () => void;
  nextLabel?: string;
  prevLabel?: string;
  nextDisabled?: boolean;
  isLastStep?: boolean;
  className?: string; // Add className support
  style?: StyleProp<ViewStyle>;
}

export function NavButtons({
  onNext,
  onPrev,
  nextLabel = 'Next',
  prevLabel = 'Previous',
  nextDisabled = false,
  isLastStep = false,
  className = '',
  style
}: NavButtonsProps) {
  // Create icons for the buttons
  const backIcon = <Ionicons name="arrow-back" size={20} className="text-text-default" />;
  const nextIcon = !isLastStep ? <Ionicons name="arrow-forward" size={20} className="text-white" /> : undefined;

  return (
    <View className={`flex-row justify-between items-center ${className}`} style={style}>
      <View className="flex-1 items-start">
        {onPrev && (
          <Button
            onPress={onPrev}
            label={prevLabel}
            variant="outline"
            size="small"
            icon={backIcon}
            className="rounded-lg min-w-[100px]"
          />
        )}
      </View>

      <Button
        onPress={onNext ?? (() => { })}
        label={nextLabel}
        variant={isLastStep ? 'flat' : 'primary'}
        size="small"
        disabled={nextDisabled}
        icon={nextIcon}
        className={`
          rounded-lg min-w-[100px] max-w-[45%]
          ${isLastStep ? 'bg-status-success' : ''}
        `}
      />
    </View>
  );
}
