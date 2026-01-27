/**
 * Jest Setup File
 *
 * This file runs after Jest is initialized but before any tests.
 * It sets up global mocks and configurations needed by all tests.
 *
 * For AI Agents: This file mocks all external dependencies so tests
 * run in isolation without network calls or native module access.
 */

// Extend Jest matchers with React Native Testing Library helpers
import '@testing-library/jest-native/extend-expect';

// ============================================================
// ASYNC STORAGE MOCK
// ============================================================
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// ============================================================
// EXPO MODULE MOCKS
// ============================================================

// Expo Font
jest.mock('expo-font', () => ({
  loadAsync: jest.fn().mockResolvedValue(true),
  isLoaded: jest.fn().mockReturnValue(true),
  useFonts: jest.fn().mockReturnValue([true, null]),
}));

// Expo Asset
jest.mock('expo-asset', () => ({
  Asset: {
    loadAsync: jest.fn().mockResolvedValue(true),
    fromModule: jest.fn().mockReturnValue({ downloadAsync: jest.fn() }),
  },
}));

// Expo Secure Store
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Expo Router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(true),
    navigate: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  usePathname: () => '/',
  useGlobalSearchParams: () => ({}),
  Link: 'Link',
  Stack: {
    Screen: 'Screen',
  },
  Tabs: {
    Screen: 'Screen',
  },
  Redirect: 'Redirect',
}));

// Expo Image
jest.mock('expo-image', () => ({
  Image: 'Image',
  ImageBackground: 'ImageBackground',
}));

// Expo Linking
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path) => `yummyyummix://${path}`),
  parse: jest.fn((url) => ({ path: url })),
  useURL: jest.fn().mockReturnValue(null),
}));

// Expo Splash Screen
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(true),
  hideAsync: jest.fn().mockResolvedValue(true),
}));

// Expo Haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Expo Constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {},
  },
  manifest: {},
}));

// Expo Localization
jest.mock('expo-localization', () => ({
  getLocales: jest.fn().mockReturnValue([{ languageCode: 'en', countryCode: 'US' }]),
  locale: 'en-US',
  locales: ['en-US'],
}));

// ============================================================
// REACT NATIVE MOCKS
// ============================================================

// React Native Reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Suppress NativeAnimatedHelper warning
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// React Native Gesture Handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native/Libraries/Components/View/View');
  return {
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: View,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PanGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    RawButton: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    FlatList: View,
    gestureHandlerRootHOC: jest.fn((component) => component),
    Directions: {},
    GestureHandlerRootView: View,
  };
});

// ============================================================
// NATIVEWIND MOCK
// ============================================================
jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light', setColorScheme: jest.fn() }),
  styled: (Component) => Component,
}));

// ============================================================
// SUPABASE MOCK (default - can be overridden in tests)
// ============================================================
jest.mock('@/lib/supabase', () => {
  const mockSupabaseClient = {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: null, error: null }),
      signInWithOtp: jest.fn().mockResolvedValue({ data: null, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      setSession: jest.fn(),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      like: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      containedBy: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
        download: jest.fn().mockResolvedValue({ data: new Blob(), error: null }),
        remove: jest.fn().mockResolvedValue({ data: [], error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://test.com/image.jpg' } }),
        list: jest.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
    functions: {
      invoke: jest.fn().mockResolvedValue({ data: null, error: null }),
    },
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    supabase: mockSupabaseClient,
  };
});

// ============================================================
// GLOBAL TEST UTILITIES
// ============================================================

// Suppress specific console warnings in tests
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  console.warn = (...args) => {
    // Suppress known warnings that don't affect tests
    const suppressPatterns = [
      'Animated: `useNativeDriver`',
      'componentWillReceiveProps',
      'componentWillMount',
    ];
    if (!suppressPatterns.some((pattern) => args[0]?.includes?.(pattern))) {
      originalConsoleWarn(...args);
    }
  };

  console.error = (...args) => {
    // Suppress act() warnings - tests should handle this properly
    const suppressPatterns = ['Warning: An update to', 'Warning: The current testing environment'];
    if (!suppressPatterns.some((pattern) => args[0]?.includes?.(pattern))) {
      originalConsoleError(...args);
    }
  };
});

afterAll(() => {
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

// Global helper to create mock functions with better typing
global.createMockFn = () => jest.fn();

// Global timeout configuration
jest.setTimeout(10000);
