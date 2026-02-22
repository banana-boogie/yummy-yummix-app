/**
 * useVoiceChat Regression Tests
 *
 * Tests for the critical logic added in the voice chat overhaul:
 * 1. Message ordering — user messages inserted before assistant messages
 * 2. Response ID filtering — stale events from interrupted responses ignored
 * 3. Interruption handling — finalize with content, remove without content
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// ============================================================
// SETUP
// ============================================================

import { useVoiceChat } from '../useVoiceChat';

// ============================================================
// MOCK PROVIDER
// ============================================================

type ListenerFn = (...args: any[]) => void;

class MockVoiceProvider {
    private listeners = new Map<string, Set<ListenerFn>>();

    // Mock implementations
    initialize = jest.fn().mockResolvedValue({
        remainingMinutes: '25.0',
        minutesUsed: '5.0',
        quotaLimit: 30,
        warning: null,
    });
    startConversation = jest.fn().mockResolvedValue(undefined);
    stopConversation = jest.fn();
    setContext = jest.fn();
    sendToolResult = jest.fn();
    getStatus = jest.fn().mockReturnValue('idle');
    getRemainingQuota = jest.fn();
    destroy = jest.fn().mockResolvedValue(undefined);

    on(event: string, callback: ListenerFn) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
    }

    off(event: string, callback: ListenerFn) {
        this.listeners.get(event)?.delete(callback);
    }

    /** Simulate a server event by invoking registered listeners */
    emit(event: string, ...args: any[]) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            for (const cb of listeners) {
                cb(...args);
            }
        }
    }
}

// ============================================================
// MODULE MOCKS
// ============================================================

let mockProvider: MockVoiceProvider;

jest.mock('@/services/voice/VoiceProviderFactory', () => ({
    VoiceProviderFactory: {
        create: jest.fn(() => mockProvider),
    },
}));

const mockRegisterSession = jest.fn();
const mockUnregisterSession = jest.fn();

jest.mock('@/contexts/VoiceSessionContext', () => ({
    useVoiceSession: () => ({
        registerSession: mockRegisterSession,
        unregisterSession: mockUnregisterSession,
    }),
}));

jest.mock('@/contexts/UserProfileContext', () => ({
    useUserProfile: () => ({
        userProfile: { dietaryRestrictions: [], dietTypes: [] },
    }),
}));

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => ({ language: 'en' }),
}));

jest.mock('@/contexts/MeasurementContext', () => ({
    useMeasurement: () => ({ measurementSystem: 'metric' }),
}));

// Override supabase auth mock for a valid session
const { supabase } = require('@/lib/supabase');

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockProvider = new MockVoiceProvider();

    supabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token-abc' } },
        error: null,
    });
});

afterEach(() => {
    jest.useRealTimers();
});

/** Helper: start the conversation and wait for provider setup to complete */
async function startAndSetup(result: { current: ReturnType<typeof useVoiceChat> }) {
    await act(async () => {
        await result.current.startConversation();
    });
    expect(mockProvider.initialize).toHaveBeenCalled();
    expect(mockProvider.startConversation).toHaveBeenCalled();
}

// ============================================================
// MESSAGE ORDERING
// ============================================================

describe('message ordering', () => {
    it('inserts user message before the current streaming assistant message', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // Simulate assistant starting to speak (creates streaming message)
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'Hello ', 'resp-1');
        });

        // The streaming assistant message should exist
        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].role).toBe('assistant');
        const assistantMsgId = result.current.transcriptMessages[0].id;

        // User interrupts with speech while assistant is streaming
        act(() => {
            mockProvider.emit('userTranscriptComplete', 'Wait, actually...');
        });

        // User message should be BEFORE the assistant message
        expect(result.current.transcriptMessages).toHaveLength(2);
        expect(result.current.transcriptMessages[0].role).toBe('user');
        expect(result.current.transcriptMessages[0].content).toBe('Wait, actually...');
        expect(result.current.transcriptMessages[1].role).toBe('assistant');
        expect(result.current.transcriptMessages[1].id).toBe(assistantMsgId);
    });

    it('inserts user message before the last completed assistant message', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // Simulate a complete assistant turn
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'Here is the recipe.', 'resp-1');
        });
        act(() => {
            mockProvider.emit('assistantTranscriptComplete', 'Here is the recipe.', 'resp-1');
        });

        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].role).toBe('assistant');

        // User responds after assistant finished
        act(() => {
            mockProvider.emit('userTranscriptComplete', 'Thanks!');
        });

        // User message should be inserted BEFORE the assistant's last message
        // (because lastAssistantMsgIdRef is set to the completed message)
        expect(result.current.transcriptMessages).toHaveLength(2);
        expect(result.current.transcriptMessages[0].role).toBe('user');
        expect(result.current.transcriptMessages[0].content).toBe('Thanks!');
        expect(result.current.transcriptMessages[1].role).toBe('assistant');
    });

    it('appends user message at the end when no assistant message exists yet', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // User speaks first, before any assistant message
        act(() => {
            mockProvider.emit('userTranscriptComplete', 'Hello Irmixy!');
        });

        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].role).toBe('user');
        expect(result.current.transcriptMessages[0].content).toBe('Hello Irmixy!');
    });

    it('ignores empty user transcripts', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        act(() => {
            mockProvider.emit('userTranscriptComplete', '   ');
        });

        expect(result.current.transcriptMessages).toHaveLength(0);
    });
});

// ============================================================
// RESPONSE ID FILTERING
// ============================================================

describe('response ID filtering', () => {
    it('ignores assistant deltas from a stale response ID', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // Start a response with ID resp-1
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'First response ', 'resp-1');
        });

        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].content).toBe('First response ');

        // A stale delta from a different response ID should be ignored
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'stale data', 'resp-old');
        });

        // Should still have just one message with original content
        expect(result.current.transcriptMessages).toHaveLength(1);
    });

    it('ignores assistantTranscriptComplete from a stale response ID', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // Start response resp-1
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'Active response', 'resp-1');
        });

        // Complete from stale response should be ignored
        act(() => {
            mockProvider.emit('assistantTranscriptComplete', 'Stale complete', 'resp-old');
        });

        // The streaming message should still be there, not finalized with stale content
        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].content).toBe('Active response');
    });

    it('accepts deltas without a response ID when no active response is tracked', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // Delta without response ID should work fine
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'No ID delta');
        });

        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].content).toBe('No ID delta');
    });
});

// ============================================================
// INTERRUPTION HANDLING
// ============================================================

describe('interruption handling', () => {
    it('finalizes streaming message with content when interrupted', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // Assistant starts speaking
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'Partial response content', 'resp-1');
        });

        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].role).toBe('assistant');

        // Response gets interrupted (e.g., user started speaking)
        act(() => {
            mockProvider.emit('responseInterrupted', 'resp-1');
        });

        // Message should still exist with the partial content (finalized)
        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].content).toBe('Partial response content');
    });

    it('removes streaming message when interrupted with no meaningful content', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // Assistant starts but only has whitespace
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', '   ', 'resp-1');
        });

        expect(result.current.transcriptMessages).toHaveLength(1);

        // Response gets interrupted with only whitespace content
        act(() => {
            mockProvider.emit('responseInterrupted', 'resp-1');
        });

        // Empty message should be removed
        expect(result.current.transcriptMessages).toHaveLength(0);
    });

    it('ignores interruption from a stale response ID', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // Start current response
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'Current response', 'resp-2');
        });

        expect(result.current.transcriptMessages).toHaveLength(1);

        // Stale interruption from old response should be ignored
        act(() => {
            mockProvider.emit('responseInterrupted', 'resp-old');
        });

        // Current streaming message should be untouched
        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].content).toBe('Current response');
    });

    it('handles interruption when no streaming message exists', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // Interruption with no active streaming message should not crash
        act(() => {
            mockProvider.emit('responseInterrupted', 'resp-1');
        });

        expect(result.current.transcriptMessages).toHaveLength(0);
    });
});

// ============================================================
// FULL CONVERSATION FLOW
// ============================================================

describe('full conversation flow', () => {
    it('handles a multi-turn conversation with correct ordering', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // Turn 1: User speaks
        act(() => {
            mockProvider.emit('userTranscriptComplete', 'Find me a pasta recipe');
        });

        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].content).toBe('Find me a pasta recipe');

        // Turn 1: Assistant responds
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'Sure! ', 'resp-1');
        });
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'Here is a pasta recipe.', 'resp-1');
            jest.advanceTimersByTime(100); // flush delta batch
        });
        act(() => {
            mockProvider.emit('assistantTranscriptComplete', 'Sure! Here is a pasta recipe.', 'resp-1');
        });

        expect(result.current.transcriptMessages).toHaveLength(2);
        expect(result.current.transcriptMessages[0].content).toBe('Find me a pasta recipe');
        expect(result.current.transcriptMessages[1].content).toBe('Sure! Here is a pasta recipe.');

        // Turn 2: User speaks again — should be inserted before the last assistant message
        act(() => {
            mockProvider.emit('userTranscriptComplete', 'Make it spicy');
        });

        expect(result.current.transcriptMessages).toHaveLength(3);
        // After user speaks, lastAssistantMsgIdRef is cleared, so the order should be:
        // [user "Find me...", user "Make it spicy" (inserted before last assistant), assistant "Sure!..."]
        expect(result.current.transcriptMessages[0].content).toBe('Find me a pasta recipe');
        expect(result.current.transcriptMessages[1].role).toBe('user');
        expect(result.current.transcriptMessages[1].content).toBe('Make it spicy');
        expect(result.current.transcriptMessages[2].role).toBe('assistant');
    });

    it('cleans up delta timer and resets refs on stop', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // Start streaming
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'Hello', 'resp-1');
        });

        // Stop conversation
        act(() => {
            result.current.stopConversation();
        });

        expect(mockProvider.stopConversation).toHaveBeenCalled();
        expect(mockUnregisterSession).toHaveBeenCalled();
    });
});
