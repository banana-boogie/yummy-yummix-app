import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, View } from 'react-native';
import { COLORS } from '@/constants/design-tokens';

interface ConfettiBurstProps {
  active: boolean;
}

const PIECE_COUNT = 14;

export function ConfettiBurst({ active }: ConfettiBurstProps) {
  const pieces = useMemo(() => {
    const palette = [
      COLORS.primary.darkest,
      COLORS.primary.dark,
      COLORS.primary.medium,
      COLORS.primary.light,
      COLORS.status.success,
    ];

    return Array.from({ length: PIECE_COUNT }).map((_, index) => ({
      left: Math.random() * 260 + 10,
      size: 6 + (index % 5) * 2,
      color: palette[index % palette.length],
      drift: (index % 2 === 0 ? 1 : -1) * (12 + index * 2),
      delay: index * 40,
    }));
  }, []);

  const animations = useRef(pieces.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!active) return;
    animations.forEach((value) => value.setValue(0));
    Animated.parallel(
      animations.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 900,
          delay: pieces[index]?.delay ?? 0,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [active, animations, pieces]);

  return (
    <View pointerEvents="none" className="absolute left-0 right-0 top-0 h-40">
      {pieces.map((piece, index) => {
        const anim = animations[index];
        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 180],
        });
        const translateX = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, piece.drift],
        });
        const rotate = anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '140deg'],
        });
        const opacity = anim.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [1, 1, 0],
        });

        return (
          <Animated.View
            key={`confetti-${index}`}
            className="absolute"
            style={{
              left: piece.left,
              top: 0,
              width: piece.size,
              height: piece.size,
              backgroundColor: piece.color,
              borderRadius: 2,
              opacity,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}
