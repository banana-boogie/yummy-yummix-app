import { StatusBar } from 'react-native';
import { SPACING } from './design-tokens';
// Animation constants for scrolling and headers
export const ANIMATION = {
  STATUS_BAR_HEIGHT: StatusBar.currentHeight || 0 + (SPACING as any).lg,
  HEADER_CONTENT_HEIGHT: 110,

  // Derived values
  get HEADER_MAX_HEIGHT() {
    return this.HEADER_CONTENT_HEIGHT + this.STATUS_BAR_HEIGHT;
  },
  get HEADER_MIN_HEIGHT() {
    return 0;
  },
  get HEADER_SCROLL_DISTANCE() {
    return this.HEADER_MAX_HEIGHT - this.HEADER_MIN_HEIGHT;
  },

  SEARCH_BAR_HEIGHT: 56,

  get SEARCH_BAR_TOP_POSITION() {
    return this.HEADER_MAX_HEIGHT;
  },
  get SEARCH_BAR_COLLAPSED_POSITION() {
    return this.STATUS_BAR_HEIGHT + (SPACING as any).lg;
  },

  // Animation transition threshold
  get TRANSITION_POINT() {
    return this.HEADER_SCROLL_DISTANCE * 0.6;
  },
}; 