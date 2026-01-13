import { useRef } from 'react';
import { Animated } from 'react-native';
import { ANIMATION } from '@/constants/animation';

export const useRecipeHeaderAnimation = () => {
  // Initialize animation value for scroll position
  const scrollY = useRef(new Animated.Value(0)).current;

  // Create event handler for scrolling
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  // Calculate animations based on scroll position
  const headerHeight = scrollY.interpolate({
    inputRange: [0, ANIMATION.TRANSITION_POINT],
    outputRange: [ANIMATION.HEADER_MAX_HEIGHT, ANIMATION.HEADER_MIN_HEIGHT],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, ANIMATION.TRANSITION_POINT * 0.7],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const searchBarTop = scrollY.interpolate({
    inputRange: [0, ANIMATION.TRANSITION_POINT, ANIMATION.HEADER_SCROLL_DISTANCE],
    outputRange: [
      ANIMATION.SEARCH_BAR_TOP_POSITION, 
      ANIMATION.SEARCH_BAR_COLLAPSED_POSITION + 10, 
      ANIMATION.SEARCH_BAR_COLLAPSED_POSITION
    ],
    extrapolate: 'clamp',
  });

  const searchBarBackgroundOpacity = scrollY.interpolate({
    inputRange: [ANIMATION.TRANSITION_POINT * 0.5, ANIMATION.TRANSITION_POINT],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const statusBarOpacity = scrollY.interpolate({
    inputRange: [0, ANIMATION.TRANSITION_POINT * 0.3, ANIMATION.TRANSITION_POINT * 0.5],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  return {
    scrollY,
    handleScroll,
    headerHeight,
    headerOpacity,
    searchBarTop,
    searchBarBackgroundOpacity,
    statusBarOpacity,
  };
}; 