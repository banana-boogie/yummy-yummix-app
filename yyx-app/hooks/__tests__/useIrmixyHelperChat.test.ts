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

const mockResetChat = jest.fn();
const mockSetIrmixyChatSessionId = jest.fn();
const mockSetIrmixyChatMessages = jest.fn();
const mockSetIrmixyVoiceTranscriptMessages = jest.fn();

jest.mock('@/contexts/CookingSessionContext', () => ({
  useCookingSession: () => ({
    irmixyChatSessionId: 'test-session-123',
    setIrmixyChatSessionId: mockSetIrmixyChatSessionId,
    irmixyChatMessages: [],
    setIrmixyChatMessages: mockSetIrmixyChatMessages,
    irmixyVoiceTranscriptMessages: [],
    setIrmixyVoiceTranscriptMessages: mockSetIrmixyVoiceTranscriptMessages,
    resetChat: mockResetChat,
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
    const { result } = renderHook(() => useIrmixyHelperChat());

    expect(result.current.isVisible).toBe(false);
  });

  it('sets isVisible to true when open is called', () => {
    const { result } = renderHook(() => useIrmixyHelperChat());

    act(() => {
      result.current.open();
    });

    expect(result.current.isVisible).toBe(true);
  });

  it('sets isVisible to false when close is called', () => {
    const { result } = renderHook(() => useIrmixyHelperChat());

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
    const { result } = renderHook(() => useIrmixyHelperChat());

    expect(result.current.sessionProps.externalSessionId).toBe('test-session-123');
    expect(result.current.sessionProps.onExternalSessionIdChange).toBe(mockSetIrmixyChatSessionId);
    expect(result.current.sessionProps.externalMessages).toEqual([]);
    expect(result.current.sessionProps.onExternalMessagesChange).toBe(mockSetIrmixyChatMessages);
    expect(result.current.sessionProps.externalVoiceTranscriptMessages).toEqual([]);
    expect(result.current.sessionProps.onExternalVoiceTranscriptMessagesChange).toBe(mockSetIrmixyVoiceTranscriptMessages);
  });

  it('calls resetChat on unmount to clear session state', () => {
    const { unmount } = renderHook(() => useIrmixyHelperChat());

    expect(mockResetChat).not.toHaveBeenCalled();

    unmount();

    expect(mockResetChat).toHaveBeenCalledTimes(1);
  });
});
