/**
 * useIrmixyHelperChat Hook Tests
 *
 * Tests for the hook that manages IrmixyCookingModal visibility
 * and CookingSession chat state persistence.
 */

import { renderHook, act } from '@testing-library/react-native';

import { useIrmixyHelperChat } from '@/hooks/useIrmixyHelperChat';

// ============================================================
// MOCKS
// ============================================================

const mockClaimForRecipe = jest.fn();
const mockSetIrmixyChatSessionId = jest.fn();
const mockSetIrmixyChatMessages = jest.fn();
const mockSetIrmixyVoiceTranscriptMessages = jest.fn();

jest.mock('@/contexts/CookingSessionContext', () => ({
  useCookingSession: () => ({
    activeRecipeId: null,
    claimForRecipe: mockClaimForRecipe,
    irmixyChatSessionId: 'test-session-123',
    setIrmixyChatSessionId: mockSetIrmixyChatSessionId,
    irmixyChatMessages: [],
    setIrmixyChatMessages: mockSetIrmixyChatMessages,
    irmixyVoiceTranscriptMessages: [],
    setIrmixyVoiceTranscriptMessages: mockSetIrmixyVoiceTranscriptMessages,
    resetChat: jest.fn(),
  }),
}));

// ============================================================
// TESTS
// ============================================================

describe('useIrmixyHelperChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns isVisible as false initially', () => {
    const { result } = renderHook(
      ({ id }) => useIrmixyHelperChat(id),
      { initialProps: { id: 'recipe-1' } },
    );

    expect(result.current.isVisible).toBe(false);
  });

  it('sets isVisible to true when open is called', () => {
    const { result } = renderHook(
      ({ id }) => useIrmixyHelperChat(id),
      { initialProps: { id: 'recipe-1' } },
    );

    act(() => {
      result.current.open();
    });

    expect(result.current.isVisible).toBe(true);
  });

  it('sets isVisible to false when close is called', () => {
    const { result } = renderHook(
      ({ id }) => useIrmixyHelperChat(id),
      { initialProps: { id: 'recipe-1' } },
    );

    act(() => {
      result.current.open();
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      result.current.close();
    });
    expect(result.current.isVisible).toBe(false);
  });

  it('exposes sessionProps with context values', () => {
    const { result } = renderHook(
      ({ id }) => useIrmixyHelperChat(id),
      { initialProps: { id: 'recipe-1' } },
    );

    expect(result.current.sessionProps.externalSessionId).toBe('test-session-123');
    expect(result.current.sessionProps.onExternalSessionIdChange).toBe(mockSetIrmixyChatSessionId);
    expect(result.current.sessionProps.externalMessages).toEqual([]);
    expect(result.current.sessionProps.onExternalMessagesChange).toBe(mockSetIrmixyChatMessages);
    expect(result.current.sessionProps.externalVoiceTranscriptMessages).toEqual([]);
    expect(result.current.sessionProps.onExternalVoiceTranscriptMessagesChange).toBe(mockSetIrmixyVoiceTranscriptMessages);
  });

  it('claims session for recipe on mount', () => {
    renderHook(
      ({ id }) => useIrmixyHelperChat(id),
      { initialProps: { id: 'recipe-1' } },
    );

    expect(mockClaimForRecipe).toHaveBeenCalledWith('recipe-1');
  });

  it('claims session for new recipe when recipeId changes', () => {
    const { rerender } = renderHook(
      ({ id }) => useIrmixyHelperChat(id),
      { initialProps: { id: 'recipe-1' } },
    );

    expect(mockClaimForRecipe).toHaveBeenCalledWith('recipe-1');
    mockClaimForRecipe.mockClear();

    rerender({ id: 'recipe-2' });

    expect(mockClaimForRecipe).toHaveBeenCalledWith('recipe-2');
  });

  it('does not claim when recipeId is undefined', () => {
    renderHook(
      ({ id }) => useIrmixyHelperChat(id),
      { initialProps: { id: undefined as string | undefined } },
    );

    expect(mockClaimForRecipe).not.toHaveBeenCalled();
  });
});
