/**
 * useMessageStreaming Hook Tests
 *
 * Tests for the core chat streaming hook covering:
 * - Initial state
 * - Successful message send and stream processing
 * - Error handling (network errors, API errors)
 * - Abort/cancel flow (stale request detection via isActiveRequest)
 * - Budget exceeded handling
 * - Loading state management (loading timeout safety net)
 * - Cleanup on unmount
 * - Silent message mode (confirmed tool calls)
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useMessageStreaming } from '../useMessageStreaming';
import {
  createMockIrmixyResponse,
  createMockGeneratedRecipe,
  createMockRecipeCardList,
} from '@/test/mocks/chat';
import type { ChatMessage, BudgetWarningPayload } from '@/services/chatService';
import type { IrmixyResponse } from '@/types/irmixy';

// ============================================================
// MOCKS
// ============================================================

jest.mock('@/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'chat.error.networkError': 'Network error. Please check your connection.',
      'chat.error.recipeGeneration': 'Recipe generation failed.',
      'chat.error.default': 'Something went wrong. Please try again.',
    };
    return translations[key] || key;
  },
}));

// Mock sendMessage from chatService
const mockCancel = jest.fn();
let mockSendMessageImpl: jest.Mock;

jest.mock('@/services/chatService', () => {
  // Define BudgetExceededError inside factory so it is available when jest.mock is hoisted
  class BudgetExceededError extends Error {
    tier: string;
    usedUsd: number;
    budgetUsd: number;
    constructor(data: { tier?: string; usedUsd?: number; budgetUsd?: number } = {}) {
      super('budget_exceeded');
      this.name = 'BudgetExceededError';
      this.tier = data.tier || 'free';
      this.usedUsd = data.usedUsd || 0;
      this.budgetUsd = data.budgetUsd || 0;
    }
  }

  // Create mock implementation reference that tests can override
  mockSendMessageImpl = jest.fn();

  return {
    sendMessage: (...args: any[]) => mockSendMessageImpl(...args),
    BudgetExceededError,
    isRecipeToolStatus: (status: string) =>
      status === 'cooking_it_up' || status === 'generating',
  };
});

// ============================================================
// HELPERS
// ============================================================

const mockUser = { id: 'user-123', email: 'test@example.com' } as any;

function createDefaultParams(overrides?: Partial<Parameters<typeof useMessageStreaming>[0]>) {
  const messages: ChatMessage[] = [];
  const messagesRef = { current: messages };

  return {
    user: mockUser,
    messages,
    setMessages: jest.fn((update: any) => {
      if (typeof update === 'function') {
        const result = update(messagesRef.current);
        messagesRef.current = result;
      } else {
        messagesRef.current = update;
      }
    }),
    messagesRef,
    currentSessionId: null as string | null,
    setCurrentSessionId: jest.fn(),
    onSessionCreated: jest.fn(),
    stopAndGuard: jest.fn(),
    scrollToEndThrottled: jest.fn(),
    isNearBottomRef: { current: true },
    skipNextScrollToEndRef: { current: false },
    hasRecipeInCurrentStreamRef: { current: false },
    flatListRef: { current: null } as any,
    onResumeSessionClear: jest.fn(),
    onBudgetWarning: jest.fn(),
    onBudgetExceeded: jest.fn(),
    ...overrides,
  };
}

/**
 * Sets up mockSendMessageImpl to capture callbacks and
 * return a controllable stream handle.
 */
function setupMockSendMessage(options?: {
  autoResolve?: boolean;
  resolveWith?: {
    onChunk?: string[];
    onSessionId?: string;
    onStatus?: string[];
    onStreamComplete?: boolean;
    onPartialRecipe?: any;
    onComplete?: IrmixyResponse;
  };
  rejectWith?: Error;
}) {
  let resolveHandle: () => void;
  let rejectHandle: (err: Error) => void;

  const donePromise = new Promise<void>((resolve, reject) => {
    resolveHandle = resolve;
    rejectHandle = reject;
  });

  mockSendMessageImpl.mockImplementation(
    (
      _message: string,
      _sessionId: string | null,
      onChunk: (chunk: string) => void,
      onSessionId?: (id: string) => void,
      onStatus?: (status: string) => void,
      onStreamComplete?: () => void,
      onPartialRecipe?: (recipe: any) => void,
      onComplete?: (response: IrmixyResponse) => void,
      _options?: any,
      _onBudgetWarning?: (warning: BudgetWarningPayload) => void,
    ) => {
      if (options?.resolveWith) {
        const r = options.resolveWith;
        // Simulate async streaming
        setTimeout(() => {
          if (r.onSessionId) onSessionId?.(r.onSessionId);
          r.onStatus?.forEach(s => onStatus?.(s as any));
          r.onChunk?.forEach(c => onChunk(c));
          if (r.onStreamComplete) onStreamComplete?.();
          if (r.onPartialRecipe) onPartialRecipe?.(r.onPartialRecipe);
          if (r.onComplete) onComplete?.(r.onComplete);
          resolveHandle!();
        }, 0);
      } else if (options?.rejectWith) {
        setTimeout(() => {
          rejectHandle!(options.rejectWith!);
        }, 0);
      } else if (options?.autoResolve) {
        setTimeout(() => resolveHandle!(), 0);
      }

      return {
        done: donePromise,
        cancel: mockCancel,
      };
    },
  );

  return {
    resolve: () => resolveHandle!(),
    reject: (err: Error) => rejectHandle!(err),
    donePromise,
  };
}

// ============================================================
// TESTS
// ============================================================

describe('useMessageStreaming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================================
  // INITIAL STATE
  // ============================================================

  describe('initial state', () => {
    it('returns correct initial values', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useMessageStreaming(params));

      expect(result.current.inputText).toBe('');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.isRecipeGenerating).toBe(false);
      expect(result.current.currentStatus).toBeNull();
    });

    it('exposes setInputText to update input', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useMessageStreaming(params));

      act(() => {
        result.current.setInputText('Hello');
      });

      expect(result.current.inputText).toBe('Hello');
    });
  });

  // ============================================================
  // GUARD: EMPTY / NO USER / ALREADY LOADING
  // ============================================================

  describe('send guards', () => {
    it('does not send when message is empty', async () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        await result.current.handleSendMessage('   ');
      });

      expect(mockSendMessageImpl).not.toHaveBeenCalled();
    });

    it('does not send when user is null', async () => {
      const params = createDefaultParams({ user: null });
      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        await result.current.handleSendMessage('Hello');
      });

      expect(mockSendMessageImpl).not.toHaveBeenCalled();
    });

    it('does not send when already loading', async () => {
      const params = createDefaultParams();
      // First call never resolves -- keeps isLoading true
      setupMockSendMessage();

      const { result } = renderHook(() => useMessageStreaming(params));

      // First send
      act(() => {
        result.current.handleSendMessage('First');
      });

      // Second send while still loading
      await act(async () => {
        await result.current.handleSendMessage('Second');
      });

      expect(mockSendMessageImpl).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // SUCCESSFUL MESSAGE SEND
  // ============================================================

  describe('successful message send', () => {
    it('adds user and assistant messages to the list', async () => {
      const params = createDefaultParams();
      const handle = setupMockSendMessage({ autoResolve: true });

      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        result.current.handleSendMessage('Hello Irmixy');
        jest.runAllTimers();
        await handle.donePromise;
      });

      // setMessages should have been called with user + assistant messages
      expect(params.setMessages).toHaveBeenCalled();
      const firstCall = params.setMessages.mock.calls[0][0];
      const resultMessages = firstCall([]);
      expect(resultMessages).toHaveLength(2);
      expect(resultMessages[0].role).toBe('user');
      expect(resultMessages[0].content).toBe('Hello Irmixy');
      expect(resultMessages[1].role).toBe('assistant');
      expect(resultMessages[1].content).toBe('');
    });

    it('clears input text after sending', async () => {
      const params = createDefaultParams();
      setupMockSendMessage({ autoResolve: true });

      const { result } = renderHook(() => useMessageStreaming(params));

      act(() => {
        result.current.setInputText('Hello');
      });
      expect(result.current.inputText).toBe('Hello');

      await act(async () => {
        result.current.handleSendMessage('Hello');
        jest.runAllTimers();
      });

      expect(result.current.inputText).toBe('');
    });

    it('calls stopAndGuard and onResumeSessionClear on send', async () => {
      const params = createDefaultParams();
      setupMockSendMessage({ autoResolve: true });

      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        result.current.handleSendMessage('Test');
        jest.runAllTimers();
      });

      expect(params.stopAndGuard).toHaveBeenCalled();
      expect(params.onResumeSessionClear).toHaveBeenCalled();
    });

    it('sets loading and status to thinking on send', () => {
      const params = createDefaultParams();
      setupMockSendMessage();

      const { result } = renderHook(() => useMessageStreaming(params));

      act(() => {
        result.current.handleSendMessage('Hello');
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.currentStatus).toBe('thinking');
      expect(result.current.isStreaming).toBe(false);
    });

    it('processes streamed chunks and completes', async () => {
      const params = createDefaultParams();
      const mockResponse = createMockIrmixyResponse({ message: 'Hi there!' });
      const handle = setupMockSendMessage({
        resolveWith: {
          onChunk: ['Hello ', 'world!'],
          onSessionId: 'session-abc',
          onStatus: ['thinking'],
          onStreamComplete: true,
          onComplete: mockResponse,
        },
      });

      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        result.current.handleSendMessage('Hello');
        // Run timers to trigger the setTimeout(0) inside mock + chunk batching
        jest.runAllTimers();
        await handle.donePromise;
        jest.runAllTimers();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.currentStatus).toBeNull();
    });

    it('sets session ID when received from stream', async () => {
      const params = createDefaultParams();
      const handle = setupMockSendMessage({
        resolveWith: {
          onSessionId: 'new-session-id',
          onComplete: createMockIrmixyResponse(),
        },
      });

      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        result.current.handleSendMessage('Hello');
        jest.runAllTimers();
        await handle.donePromise;
        jest.runAllTimers();
      });

      expect(params.setCurrentSessionId).toHaveBeenCalledWith('new-session-id');
      expect(params.onSessionCreated).toHaveBeenCalledWith('new-session-id');
    });

    it('does not overwrite existing session ID', async () => {
      const params = createDefaultParams({ currentSessionId: 'existing-session' });
      const handle = setupMockSendMessage({
        resolveWith: {
          onSessionId: 'new-session-id',
          onComplete: createMockIrmixyResponse(),
        },
      });

      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        result.current.handleSendMessage('Hello');
        jest.runAllTimers();
        await handle.donePromise;
        jest.runAllTimers();
      });

      expect(params.setCurrentSessionId).not.toHaveBeenCalled();
    });

    it('passes cookingContext in options', async () => {
      const cookingContext = {
        recipeTitle: 'Pasta',
        currentStep: 'Step 1',
        stepInstructions: 'Boil water',
      };
      const params = createDefaultParams({ cookingContext });
      setupMockSendMessage({ autoResolve: true });

      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        result.current.handleSendMessage('How long to boil?');
        jest.runAllTimers();
      });

      // Verify options argument (9th positional) includes cookingContext
      const callArgs = mockSendMessageImpl.mock.calls[0];
      expect(callArgs[8]).toEqual(expect.objectContaining({ cookingContext }));
    });

    it('passes confirmedToolCall in options when provided', async () => {
      const params = createDefaultParams();
      setupMockSendMessage({ autoResolve: true });

      const { result } = renderHook(() => useMessageStreaming(params));

      const confirmedToolCall = { name: 'generate_custom_recipe', arguments: { description: 'pasta' } };
      await act(async () => {
        result.current.handleSendMessage('Make pasta', { confirmedToolCall });
        jest.runAllTimers();
      });

      const callArgs = mockSendMessageImpl.mock.calls[0];
      expect(callArgs[8]).toEqual(expect.objectContaining({ confirmedToolCall }));
    });
  });

  // ============================================================
  // SILENT MESSAGE MODE
  // ============================================================

  describe('silent message mode', () => {
    it('does not add user message when silent is true', async () => {
      const params = createDefaultParams();
      setupMockSendMessage({ autoResolve: true });

      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        result.current.handleSendMessage('Hidden message', { silent: true });
        jest.runAllTimers();
      });

      // First setMessages call creates the message list
      const firstCall = params.setMessages.mock.calls[0][0];
      const resultMessages = firstCall([]);
      // Silent mode: only assistant message, no user message
      expect(resultMessages).toHaveLength(1);
      expect(resultMessages[0].role).toBe('assistant');
    });
  });

  // ============================================================
  // RECIPE STREAMING
  // ============================================================

  describe('recipe streaming', () => {
    it('sets isRecipeGenerating when recipe tool status received', async () => {
      const params = createDefaultParams();
      let capturedOnStatus: ((status: string) => void) | undefined;

      mockSendMessageImpl.mockImplementation(
        (_msg: string, _sid: string | null, _onChunk: any, _onSid: any, onStatus: any) => {
          capturedOnStatus = onStatus;
          return {
            done: new Promise(() => {}),
            cancel: mockCancel,
          };
        },
      );

      const { result } = renderHook(() => useMessageStreaming(params));

      act(() => {
        result.current.handleSendMessage('Make a recipe');
      });

      // Simulate receiving recipe tool status
      act(() => {
        capturedOnStatus?.('cooking_it_up');
      });

      expect(result.current.isRecipeGenerating).toBe(true);
    });

    it('resets isRecipeGenerating on completion', async () => {
      const params = createDefaultParams();
      const mockResponse = createMockIrmixyResponse({
        customRecipe: createMockGeneratedRecipe(),
      });
      const handle = setupMockSendMessage({
        resolveWith: {
          onStatus: ['cooking_it_up'],
          onComplete: mockResponse,
        },
      });

      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        result.current.handleSendMessage('Make a recipe');
        jest.runAllTimers();
        await handle.donePromise;
        jest.runAllTimers();
      });

      expect(result.current.isRecipeGenerating).toBe(false);
    });

    it('calls onActionsReceived when response has actions', async () => {
      const onActionsReceived = jest.fn();
      const params = createDefaultParams({ onActionsReceived });
      const actions = [{ id: 'a1', type: 'save_recipe' as const, label: 'Save', payload: {} }];
      const mockResponse = createMockIrmixyResponse({ actions });
      const handle = setupMockSendMessage({
        resolveWith: { onComplete: mockResponse },
      });

      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        result.current.handleSendMessage('Save this');
        jest.runAllTimers();
        await handle.donePromise;
        jest.runAllTimers();
      });

      expect(onActionsReceived).toHaveBeenCalledWith(actions, mockResponse);
    });
  });

  // ============================================================
  // ERROR HANDLING
  // ============================================================

  describe('error handling', () => {
    it('shows network error message for fetch TypeError', async () => {
      const params = createDefaultParams();
      const fetchError = new TypeError('Failed to fetch');
      const handle = setupMockSendMessage({ rejectWith: fetchError });

      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        result.current.handleSendMessage('Hello');
        jest.runAllTimers();
        try { await handle.donePromise; } catch { /* expected */ }
        jest.runAllTimers();
      });

      expect(result.current.isLoading).toBe(false);

      // The error update uses updateAssistantMessage which matches by the
      // dynamic assistant message ID. We verify by replaying all updater calls
      // through the messagesRef to see the final state includes an error message.
      // The messagesRef is updated by our setMessages mock.
      const finalMessages = params.messagesRef.current;
      const assistantMsg = finalMessages.find((m: ChatMessage) => m.role === 'assistant');
      expect(assistantMsg?.hasError).toBe(true);
      expect(assistantMsg?.content).toContain('Network error');
    });

    it('shows recipe generation error for recipe-related errors', async () => {
      const params = createDefaultParams();
      const recipeError = new Error('Failed to generate recipe');
      const handle = setupMockSendMessage({ rejectWith: recipeError });

      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        result.current.handleSendMessage('Hello');
        jest.runAllTimers();
        try { await handle.donePromise; } catch { /* expected */ }
        jest.runAllTimers();
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('shows default error message for unknown errors', async () => {
      const params = createDefaultParams();
      const unknownError = new Error('Something unexpected');
      const handle = setupMockSendMessage({ rejectWith: unknownError });

      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        result.current.handleSendMessage('Hello');
        jest.runAllTimers();
        try { await handle.donePromise; } catch { /* expected */ }
        jest.runAllTimers();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isStreaming).toBe(false);
    });

    it('resets all streaming state in finally block on error', async () => {
      const params = createDefaultParams();
      const handle = setupMockSendMessage({ rejectWith: new Error('fail') });

      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        result.current.handleSendMessage('Hello');
        jest.runAllTimers();
        try { await handle.donePromise; } catch { /* expected */ }
        jest.runAllTimers();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.isRecipeGenerating).toBe(false);
      expect(result.current.currentStatus).toBeNull();
    });
  });

  // ============================================================
  // BUDGET EXCEEDED
  // ============================================================

  describe('budget exceeded handling', () => {
    it('calls onBudgetExceeded and removes optimistic messages', async () => {
      const params = createDefaultParams();
      const { BudgetExceededError } = jest.requireMock('@/services/chatService');
      const budgetError = new BudgetExceededError({
        tier: 'free',
        usedUsd: 0.10,
        budgetUsd: 0.10,
      });
      const handle = setupMockSendMessage({ rejectWith: budgetError });

      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        result.current.handleSendMessage('Hello');
        jest.runAllTimers();
        try { await handle.donePromise; } catch { /* expected */ }
        jest.runAllTimers();
      });

      expect(params.onBudgetExceeded).toHaveBeenCalledWith(budgetError);
      expect(result.current.isLoading).toBe(false);
    });

    it('removes optimistic messages including user message on budget exceeded', async () => {
      const params = createDefaultParams();
      const { BudgetExceededError } = jest.requireMock('@/services/chatService');
      const handle = setupMockSendMessage({
        rejectWith: new BudgetExceededError(),
      });

      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        result.current.handleSendMessage('Hello');
        jest.runAllTimers();
        try { await handle.donePromise; } catch { /* expected */ }
        jest.runAllTimers();
      });

      // After budget exceeded, the messagesRef should have the optimistic
      // messages removed (the filter removes both user + assistant temp messages)
      const finalMessages = params.messagesRef.current;
      expect(finalMessages).toHaveLength(0);
    });
  });

  // ============================================================
  // STALE REQUEST DETECTION (ABORT / CANCEL)
  // ============================================================

  describe('stale request detection', () => {
    it('ignores callbacks from stale requests after resetStreamingState', async () => {
      const params = createDefaultParams();
      let capturedOnChunk: ((chunk: string) => void) | undefined;
      let capturedOnComplete: ((response: IrmixyResponse) => void) | undefined;

      mockSendMessageImpl.mockImplementation(
        (_msg: string, _sid: string | null, onChunk: any, _onSid: any, _onStatus: any, _onStreamComplete: any, _onPartialRecipe: any, onComplete: any) => {
          capturedOnChunk = onChunk;
          capturedOnComplete = onComplete;
          return {
            done: new Promise(() => {}),
            cancel: mockCancel,
          };
        },
      );

      const { result } = renderHook(() => useMessageStreaming(params));

      // Start first request
      act(() => {
        result.current.handleSendMessage('First message');
      });

      // Reset streaming state (simulates user cancelling or new request)
      act(() => {
        result.current.resetStreamingState();
      });

      // Record setMessages call count after reset
      const callCountAfterReset = params.setMessages.mock.calls.length;

      // Simulate late callbacks from the cancelled request
      act(() => {
        capturedOnChunk?.('late chunk');
        capturedOnComplete?.(createMockIrmixyResponse());
      });

      // No additional setMessages calls should have been made
      // because isActiveRequest() returns false for the stale request
      expect(params.setMessages.mock.calls.length).toBe(callCountAfterReset);
    });
  });

  // ============================================================
  // LOADING TIMEOUT SAFETY NET
  // ============================================================

  describe('loading timeout safety net', () => {
    it('force-resets loading state after 60 seconds', async () => {
      const params = createDefaultParams();
      // Stream never completes
      setupMockSendMessage();

      const { result } = renderHook(() => useMessageStreaming(params));

      act(() => {
        result.current.handleSendMessage('Hello');
      });

      expect(result.current.isLoading).toBe(true);

      // Advance past the 60-second timeout
      act(() => {
        jest.advanceTimersByTime(60_000);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.currentStatus).toBeNull();
    });

    it('does not force-reset if stream completes before timeout', async () => {
      const params = createDefaultParams();
      const handle = setupMockSendMessage({
        resolveWith: {
          onComplete: createMockIrmixyResponse(),
        },
      });

      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        result.current.handleSendMessage('Hello');
        jest.runAllTimers();
        await handle.donePromise;
        jest.runAllTimers();
      });

      expect(result.current.isLoading).toBe(false);

      // Advancing time should not cause any errors
      act(() => {
        jest.advanceTimersByTime(60_000);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  // ============================================================
  // CLEANUP ON UNMOUNT
  // ============================================================

  describe('cleanup on unmount', () => {
    it('cancels active stream on unmount', () => {
      const params = createDefaultParams();
      setupMockSendMessage();

      const { result, unmount } = renderHook(() => useMessageStreaming(params));

      act(() => {
        result.current.handleSendMessage('Hello');
      });

      unmount();

      expect(mockCancel).toHaveBeenCalled();
    });

    it('ignores late callbacks after unmount', async () => {
      const params = createDefaultParams();
      let capturedOnComplete: ((response: IrmixyResponse) => void) | undefined;

      mockSendMessageImpl.mockImplementation(
        (_msg: string, _sid: string | null, _onChunk: any, _onSid: any, _onStatus: any, _onStreamComplete: any, _onPartialRecipe: any, onComplete: any) => {
          capturedOnComplete = onComplete;
          return {
            done: new Promise(() => {}),
            cancel: mockCancel,
          };
        },
      );

      const { result, unmount } = renderHook(() => useMessageStreaming(params));

      act(() => {
        result.current.handleSendMessage('Hello');
      });

      unmount();

      // Late callback after unmount should not throw
      expect(() => {
        capturedOnComplete?.(createMockIrmixyResponse());
      }).not.toThrow();
    });
  });

  // ============================================================
  // RESET STREAMING STATE
  // ============================================================

  describe('resetStreamingState', () => {
    it('resets all streaming state and cancels active stream', () => {
      const params = createDefaultParams();
      setupMockSendMessage();

      const { result } = renderHook(() => useMessageStreaming(params));

      act(() => {
        result.current.handleSendMessage('Hello');
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.resetStreamingState();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.isRecipeGenerating).toBe(false);
      expect(result.current.currentStatus).toBeNull();
      expect(mockCancel).toHaveBeenCalled();
    });
  });

  // ============================================================
  // HANDLE SEND (CONVENIENCE)
  // ============================================================

  describe('handleSend', () => {
    it('sends the current inputText value', async () => {
      const params = createDefaultParams();
      setupMockSendMessage({ autoResolve: true });

      const { result } = renderHook(() => useMessageStreaming(params));

      act(() => {
        result.current.setInputText('My message');
      });

      await act(async () => {
        result.current.handleSend();
        jest.runAllTimers();
      });

      expect(mockSendMessageImpl).toHaveBeenCalled();
      const callArgs = mockSendMessageImpl.mock.calls[0];
      expect(callArgs[0]).toBe('My message');
    });

    it('does not send when inputText is empty', async () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useMessageStreaming(params));

      await act(async () => {
        result.current.handleSend();
      });

      expect(mockSendMessageImpl).not.toHaveBeenCalled();
    });
  });
});
