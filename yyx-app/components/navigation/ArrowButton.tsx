import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/common/Button';
import { COLORS } from '@/constants';
import { Text } from '@/components/common/Text';
import { SPACING } from '@/constants/design-tokens';

interface ArrowButtonProps {
  onPress?: () => void;
  direction?: 'forward' | 'back';
  variant?: 'primary' | 'secondary';
  textKey?: string;
  size?: 'small' | 'medium' | 'large';
}

export function ArrowButton({
  onPress,
  direction = 'forward',
  variant = 'primary',
  textKey = '',
  size = 'medium'
}: ArrowButtonProps) {
  const ArrowIcon = () => (
    <View style={[
      styles.arrowContainer,
      direction === 'back' ? styles.backContainer : styles.forwardContainer
    ]}>
      <View style={[
        styles.arrow,
        direction === 'back' && styles.backArrow,
      ]} />
    </View>
  );

  return (
    <Button
      onPress={onPress || (() => { })}
      variant={variant}
      style={styles.button}
      textStyle={styles.text}
      size={size}
    >
      <View style={styles.content}>
        {direction === 'back' && <ArrowIcon />}
        <Text style={styles.textContainer}>
          {textKey}
        </Text>
        {direction === 'forward' && <ArrowIcon />}
      </View>
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    // paddingHorizontal: SPACING.lg,
    // paddingVertical: SPACING.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: {
    color: COLORS.text.default,
  },
  textContainer: {
    fontSize: 22,
    fontWeight: '400',
  },
  arrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backContainer: {
  },
  forwardContainer: {
  },
  arrow: {
    borderStyle: 'solid',
    borderTopWidth: 10,
    borderTopColor: 'transparent',
    borderBottomWidth: 10,
    borderBottomColor: 'transparent',
    borderLeftWidth: 15,
    borderLeftColor: COLORS.primary.default,
  },
  backArrow: {
    transform: [{ rotate: '180deg' }],
  },
});
