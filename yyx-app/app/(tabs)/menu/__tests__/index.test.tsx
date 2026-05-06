import React from 'react';
import * as ReactNative from 'react-native';
import { renderWithProviders, screen, fireEvent, waitFor, act } from '@/test/utils/render';
import type {
  MealPlanResponse,
  MealPlanSlotResponse,
  PreferencesResponse,
} from '@/types/mealPlan';

const { AccessibilityInfo, Alert, BackHandler, Platform } = ReactNative;

// jsdom-style host components don't yield a node handle, so the production
// guard `if (node != null)` short-circuits in tests. Force a numeric handle so
// the focus call can be observed.
jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => {
  const actual = jest.requireActual(
    'react-native/Libraries/ReactNative/RendererProxy',
  );
  return { ...actual, findNodeHandle: () => 1 };
});

// ---------- mocks ----------

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    locale: 'en-US',
    setLanguage: jest.fn(),
    setLocale: jest.fn(),
  }),
}));

const mockLogModeChange = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
}));

jest.mock('@/services/eventService', () => ({
  eventService: {
    logPlannerTodayView: jest.fn(),
    logPlannerCookPress: jest.fn(),
    logPlannerSwapPress: jest.fn(),
    logPlannerSwapComplete: jest.fn(),
    logPlannerWeekLinkPress: jest.fn(),
    logPlannerModeChange: (p: unknown) => mockLogModeChange(p),
    logPlannerPullToRefresh: jest.fn(),
  },
}));

const mockUseMealPlanReturn: {
  current: ReturnType<typeof mockBuildHookReturn>;
} = { current: mockBuildHookReturn() };

jest.mock('@/hooks/useMealPlan', () => ({
  useMealPlan: () => mockUseMealPlanReturn.current,
}));

// BackHandler listener registry — populated by overriding addEventListener
// on the imported singleton (jest.mock would force RN init crashes).
const mockBackHandlerListeners: Record<string, () => boolean> = {};
const originalAddEventListener = BackHandler.addEventListener;
(BackHandler as unknown as {
  addEventListener: (e: string, h: () => boolean) => { remove: () => void };
}).addEventListener = (event, handler) => {
  mockBackHandlerListeners[event] = handler;
  return { remove: () => delete mockBackHandlerListeners[event] };
};
afterAll(() => {
  (BackHandler as unknown as { addEventListener: unknown }).addEventListener =
    originalAddEventListener;
});
// Force Android (jest default is iOS).
(Platform as unknown as { OS: string }).OS = 'android';

// ---------- helpers ----------

function buildSlot(id: string): MealPlanSlotResponse {
  return {
    id,
    plannedDate: '2026-04-25',
    dayIndex: 5,
    mealType: 'lunch',
    displayMealLabel: 'Lunch',
    displayOrder: 0,
    slotType: 'cook_slot',
    structureTemplate: 'single_component',
    expectedFoodGroups: [],
    selectionReason: '',
    shoppingSyncState: 'not_created',
    status: 'planned',
    swapCount: 0,
    lastSwappedAt: null,
    cookedAt: null,
    skippedAt: null,
    mergedCookingGuide: null,
    coverageComplete: true,
    components: [
      {
        id: `${id}-c0`,
        componentRole: 'main',
        sourceKind: 'recipe',
        recipeId: `recipe-${id}`,
        sourceComponentId: null,
        foodGroupsSnapshot: [],
        pairingBasis: 'standalone',
        displayOrder: 0,
        isPrimary: true,
        title: `Title ${id}`,
        imageUrl: null,
        totalTimeMinutes: 30,
        difficulty: 'easy',
        portions: 4,
        equipmentTags: [],
      },
    ],
  };
}

function buildPlan(slots: MealPlanSlotResponse[]): MealPlanResponse {
  return {
    planId: 'plan-1',
    weekStart: '2026-04-20',
    locale: 'en-US',
    requestedDayIndexes: [0, 1, 2, 3, 4],
    requestedMealTypes: ['lunch'],
    shoppingListId: 'shop-1',
    shoppingSyncState: 'not_created',
    slots,
  };
}

function mockBuildHookReturn() {
  const slots = [buildSlot('s1')];
  const prefs: PreferencesResponse = {
    mealTypes: ['lunch'],
    busyDays: [],
    activeDayIndexes: [0, 1, 2, 3, 4],
    defaultMaxWeeknightMinutes: 30,
    preferLeftoversForLunch: false,
    preferredEatTimes: {},
    setupCompletedAt: '2026-04-25T12:00:00Z',
  };
  return {
    activePlan: buildPlan(slots),
    preferences: prefs,
    isLoading: false,
    isGenerating: false,
    error: null as string | null,
    generatePlan: jest.fn(),
    updatePreferences: jest.fn(),
    swapSlot: jest
      .fn()
      .mockResolvedValue({ alternatives: [], warnings: [] }),
    applySwap: jest
      .fn()
      .mockResolvedValue({ alternatives: [], warnings: [] }),
    skipSlot: jest.fn(),
    markCooked: jest.fn(),
    generateShoppingList: jest.fn(),
    todaysSlots: slots,
    planProgress: { planned: 1, cooked: 0, skipped: 0 },
    hasCachedPlan: true,
    refetch: jest.fn().mockResolvedValue(undefined),
  };
}

// ---------- tests ----------

describe('MenuScreen mode toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockBackHandlerListeners).forEach(
      (k) => delete mockBackHandlerListeners[k],
    );
    mockUseMealPlanReturn.current = mockBuildHookReturn();
    jest.useFakeTimers().setSystemTime(new Date('2026-04-25T12:00:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('toggles to week mode when Ver mi menú link is tapped, fires analytics', async () => {
    const MenuScreen = require('@/app/(tabs)/menu/index').default;
    renderWithProviders(<MenuScreen />);

    expect(screen.getByText('Today on your menu')).toBeTruthy();

    fireEvent.press(screen.getByText('See my menu for the week →'));

    await waitFor(() => {
      expect(screen.getByText('Back to today')).toBeTruthy();
    });
    expect(mockLogModeChange).toHaveBeenCalledWith({
      from: 'today',
      to: 'week',
      trigger: 'link',
    });
  }, 20000);

  it('returns to today mode via the Volver a hoy header affordance', async () => {
    const MenuScreen = require('@/app/(tabs)/menu/index').default;
    renderWithProviders(<MenuScreen />);

    expect(screen.getByText('Today on your menu')).toBeTruthy();

    fireEvent.press(screen.getByText('See my menu for the week →'));
    await waitFor(() => {
      expect(screen.getByText('Back to today')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Back to today'));
    await waitFor(() => {
      expect(screen.getByText('Today on your menu')).toBeTruthy();
    });
    expect(mockLogModeChange).toHaveBeenLastCalledWith({
      from: 'week',
      to: 'today',
      trigger: 'back-button',
    });
  });

  it('shows blocking error state when error and no cached plan (F2)', async () => {
    mockUseMealPlanReturn.current = {
      ...mockBuildHookReturn(),
      activePlan: null as unknown as MealPlanResponse,
      hasCachedPlan: false,
      error: 'Network down',
    };

    const MenuScreen = require('@/app/(tabs)/menu/index').default;
    renderWithProviders(<MenuScreen />);

    await waitFor(() => {
      expect(screen.getByText("Couldn't load your menu")).toBeTruthy();
    });
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('shows stale-data banner when error but cached plan exists (F2)', async () => {
    mockUseMealPlanReturn.current = {
      ...mockBuildHookReturn(),
      hasCachedPlan: true,
      error: 'Network blip',
    };

    const MenuScreen = require('@/app/(tabs)/menu/index').default;
    renderWithProviders(<MenuScreen />);

    await waitFor(() => {
      expect(screen.getByText('Today on your menu')).toBeTruthy();
    });
    expect(screen.getByText('Showing saved data')).toBeTruthy();
    expect(screen.getByText('Tap to retry')).toBeTruthy();
  });

  it('shifts a11y focus when toggling to week mode (F5)', async () => {
    const focusSpy = jest
      .spyOn(AccessibilityInfo, 'setAccessibilityFocus')
      .mockImplementation(() => {});

    const MenuScreen = require('@/app/(tabs)/menu/index').default;
    renderWithProviders(<MenuScreen />);

    await waitFor(() => {
      expect(screen.getByText('Today on your menu')).toBeTruthy();
    });

    focusSpy.mockClear();
    fireEvent.press(screen.getByText('See my menu for the week →'));

    // Focus is deferred via requestAnimationFrame so refs are populated
    // before findNodeHandle runs. Flush the scheduled callback.
    await act(async () => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(focusSpy).toHaveBeenCalled();
    });

    focusSpy.mockRestore();
  });

  it('renders TodayHeroSkeleton during initial today-mode loading (F7)', async () => {
    mockUseMealPlanReturn.current = {
      ...mockBuildHookReturn(),
      isLoading: true,
      activePlan: null as unknown as MealPlanResponse,
      hasCachedPlan: false,
    };

    const MenuScreen = require('@/app/(tabs)/menu/index').default;
    const { UNSAFE_root } = renderWithProviders(<MenuScreen />);

    // Skeleton is the only animated placeholder in this state — verify the
    // loading state does NOT render the empty state copy.
    await waitFor(() => {
      expect(screen.queryByText('Today on your menu')).toBeNull();
    });
    expect(UNSAFE_root).toBeTruthy();
  });

  it('shows generation-failure alert when generatePlan rejects from the ready empty state', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const generatePlan = jest.fn().mockRejectedValue(new Error('generate failed'));
    // User is "onboarded" (preferences saved with setup_completed_at) but has
    // no active plan — the ready empty state. Pressing the CTA calls
    // generatePlan directly with saved preferences, bypassing the setup flow.
    const prefs: PreferencesResponse = {
      mealTypes: ['lunch'],
      busyDays: [2],
      activeDayIndexes: [0, 1, 2, 3, 4],
      defaultMaxWeeknightMinutes: 30,
      preferLeftoversForLunch: false,
      preferredEatTimes: {},
      setupCompletedAt: '2026-04-25T12:00:00Z',
    };
    mockUseMealPlanReturn.current = {
      ...mockBuildHookReturn(),
      activePlan: null as unknown as MealPlanResponse,
      preferences: prefs,
      generatePlan,
      todaysSlots: [],
      hasCachedPlan: false,
    };

    const MenuScreen = require('@/app/(tabs)/menu/index').default;
    renderWithProviders(<MenuScreen />);

    await waitFor(() => {
      expect(screen.getByText('Plan My Menu')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Plan My Menu'));

    await waitFor(() => {
      expect(generatePlan).toHaveBeenCalled();
    });
    expect(alertSpy).toHaveBeenCalledWith(
      "Hmm, your menu didn't come together",
      expect.any(String),
    );

    alertSpy.mockRestore();
  });

  it('opens the generated shopping list after approving a draft menu', async () => {
    const generateShoppingList = jest.fn().mockResolvedValue('shop-generated');
    const draftPlan = buildPlan([buildSlot('s1')]);
    draftPlan.shoppingListId = null;
    mockUseMealPlanReturn.current = {
      ...mockBuildHookReturn(),
      activePlan: draftPlan,
      generateShoppingList,
    };

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MenuScreen = require('@/app/(tabs)/menu/index').default;
    renderWithProviders(<MenuScreen />);

    await waitFor(() => {
      expect(screen.getByText('Today on your menu')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('See my menu for the week →'));
    await waitFor(() => {
      expect(screen.getByText('Make My List')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Make My List'));

    await waitFor(() => {
      expect(generateShoppingList).toHaveBeenCalled();
    });
    expect(mockRouterPush).toHaveBeenCalledWith(
      '/(tabs)/shopping/shop-generated',
    );
  });

  it('shows an error instead of navigating when shopping list generation returns no id', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const generateShoppingList = jest.fn().mockResolvedValue(null);
    const draftPlan = buildPlan([buildSlot('s1')]);
    draftPlan.shoppingListId = null;
    mockUseMealPlanReturn.current = {
      ...mockBuildHookReturn(),
      activePlan: draftPlan,
      generateShoppingList,
    };

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MenuScreen = require('@/app/(tabs)/menu/index').default;
    renderWithProviders(<MenuScreen />);

    fireEvent.press(await screen.findByText('See my menu for the week →'));
    fireEvent.press(await screen.findByText('Make My List'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });
    expect(mockRouterPush).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('hardware back in week mode returns to today (Android)', async () => {
    const MenuScreen = require('@/app/(tabs)/menu/index').default;
    renderWithProviders(<MenuScreen />);

    await waitFor(() => {
      expect(screen.getByText('Today on your menu')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('See my menu for the week →'));
    await waitFor(() => {
      expect(screen.getByText('Back to today')).toBeTruthy();
    });

    // Listener should now be registered.
    expect(mockBackHandlerListeners['hardwareBackPress']).toBeDefined();
    let consumed = false;
    act(() => {
      consumed = mockBackHandlerListeners['hardwareBackPress']();
    });
    expect(consumed).toBe(true);

    await waitFor(() => {
      expect(screen.getByText('Today on your menu')).toBeTruthy();
    });
    expect(mockLogModeChange).toHaveBeenLastCalledWith({
      from: 'week',
      to: 'today',
      trigger: 'hardware-back',
    });
  });
});
