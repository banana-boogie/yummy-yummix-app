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
import type { ChatMessage } from '@/services/chatService';

// Mock saveVoiceTranscript for persistence assertions
jest.mock('@/services/chatService', () => ({
    ...jest.requireActual('@/services/chatService'),
    saveVoiceTranscript: jest.fn(),
}));

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
const { saveVoiceTranscript } = require('@/services/chatService');
const mockSaveVoiceTranscript = saveVoiceTranscript as jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockProvider = new MockVoiceProvider();

    supabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token-abc' } },
        error: null,
    });

    mockSaveVoiceTranscript.mockResolvedValue({ sessionId: 'saved-session' });
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

function createMessage(id: string, content: string): ChatMessage {
    return {
        id,
        role: 'assistant',
        content,
        createdAt: new Date(),
    };
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

    it('inserts user message before the AI response when Whisper is slower than the AI', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // User speaks → speechStarted resets lastAssistantMsgIdRef
        act(() => {
            mockProvider.emit('speechStarted');
        });

        // AI responds quickly and finishes before Whisper transcription arrives
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'Here is the recipe.', 'resp-1');
        });
        act(() => {
            mockProvider.emit('assistantTranscriptComplete', 'Here is the recipe.', 'resp-1');
        });

        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].role).toBe('assistant');

        // Whisper transcription arrives late — should be inserted BEFORE the AI response
        act(() => {
            mockProvider.emit('userTranscriptComplete', 'Find me pasta');
        });

        expect(result.current.transcriptMessages).toHaveLength(2);
        expect(result.current.transcriptMessages[0].role).toBe('user');
        expect(result.current.transcriptMessages[0].content).toBe('Find me pasta');
        expect(result.current.transcriptMessages[1].role).toBe('assistant');
    });

    it('appends user message after assistant when speechStarted fires for a NEW turn', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // Turn 1: complete assistant response
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'Here is the recipe.', 'resp-1');
        });
        act(() => {
            mockProvider.emit('assistantTranscriptComplete', 'Here is the recipe.', 'resp-1');
        });

        // Turn 2: user starts new speech → resets lastAssistantMsgIdRef
        act(() => {
            mockProvider.emit('speechStarted');
        });

        // Transcription arrives before AI responds → no targetId → append at end
        act(() => {
            mockProvider.emit('userTranscriptComplete', 'Thanks!');
        });

        // Correct chronological order: assistant first (turn 1), then user (turn 2)
        expect(result.current.transcriptMessages).toHaveLength(2);
        expect(result.current.transcriptMessages[0].role).toBe('assistant');
        expect(result.current.transcriptMessages[1].role).toBe('user');
        expect(result.current.transcriptMessages[1].content).toBe('Thanks!');
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
            mockProvider.emit('speechStarted');
        });
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

        // Turn 2: User speaks again — speechStarted resets lastAssistantMsgIdRef
        act(() => {
            mockProvider.emit('speechStarted');
        });
        act(() => {
            mockProvider.emit('userTranscriptComplete', 'Make it spicy');
        });

        expect(result.current.transcriptMessages).toHaveLength(3);
        // Correct chronological order: user, assistant, user
        expect(result.current.transcriptMessages[0].content).toBe('Find me a pasta recipe');
        expect(result.current.transcriptMessages[1].role).toBe('assistant');
        expect(result.current.transcriptMessages[1].content).toBe('Sure! Here is a pasta recipe.');
        expect(result.current.transcriptMessages[2].role).toBe('user');
        expect(result.current.transcriptMessages[2].content).toBe('Make it spicy');
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

// ============================================================
// TRANSCRIPT PERSISTENCE
// ============================================================

describe('transcript persistence', () => {
    it('saves only new messages on stop', async () => {
        const existingMessage = createMessage('existing-msg', 'previous session message');
        const { result } = renderHook(() =>
            useVoiceChat({
                sessionId: 'session-1',
                initialTranscriptMessages: [existingMessage],
            })
        );

        await startAndSetup(result);

        act(() => {
            mockProvider.emit('userTranscriptComplete', 'new user message');
        });
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'new assistant message', 'resp-1');
        });
        act(() => {
            mockProvider.emit('assistantTranscriptComplete', 'new assistant message', 'resp-1');
        });

        await act(async () => {
            result.current.stopConversation();
        });

        await waitFor(() => {
            expect(mockSaveVoiceTranscript).toHaveBeenCalledTimes(1);
        });

        const savedMessages = mockSaveVoiceTranscript.mock.calls[0][0] as ChatMessage[];
        expect(savedMessages).toHaveLength(2);
        expect(savedMessages.map((m) => m.content)).toEqual([
            'new user message',
            'new assistant message',
        ]);
    });

    it('keeps failed messages unsaved and includes them in the next save', async () => {
        mockSaveVoiceTranscript
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ sessionId: 'saved-on-retry' });

        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        act(() => {
            mockProvider.emit('userTranscriptComplete', 'first message');
        });

        await act(async () => {
            result.current.stopConversation();
        });

        await waitFor(() => {
            expect(mockSaveVoiceTranscript).toHaveBeenCalledTimes(1);
        });

        act(() => {
            mockProvider.emit('userTranscriptComplete', 'second message');
        });

        await act(async () => {
            result.current.stopConversation();
        });

        await waitFor(() => {
            expect(mockSaveVoiceTranscript).toHaveBeenCalledTimes(2);
        });

        const firstSave = mockSaveVoiceTranscript.mock.calls[0][0] as ChatMessage[];
        const secondSave = mockSaveVoiceTranscript.mock.calls[1][0] as ChatMessage[];
        expect(firstSave.map((m) => m.content)).toEqual(['first message']);
        expect(secondSave.map((m) => m.content)).toEqual([
            'first message',
            'second message',
        ]);
    });

    it('does not save already-loaded session messages when no new messages were added', async () => {
        const loadedMessages = [
            createMessage('loaded-assistant', 'loaded assistant message'),
            {
                id: 'loaded-user',
                role: 'user' as const,
                content: 'loaded user message',
                createdAt: new Date(),
            },
        ];
        const { result } = renderHook(() =>
            useVoiceChat({
                sessionId: 'session-1',
                initialTranscriptMessages: loadedMessages,
            })
        );

        await startAndSetup(result);

        await act(async () => {
            result.current.stopConversation();
        });

        expect(mockSaveVoiceTranscript).not.toHaveBeenCalled();
    });
});

// ============================================================
// RESPONSE DONE SAFETY NET
// ============================================================

describe('responseDone safety net', () => {
    it('finalizes un-finalized streaming message when assistantTranscriptComplete was skipped', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // Assistant starts speaking with deltas
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'Here is ', 'resp-1');
        });
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'the answer.', 'resp-1');
            jest.advanceTimersByTime(100); // flush delta batch
        });

        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].role).toBe('assistant');

        // Simulate: assistantTranscriptComplete never fires (API skip)
        // responseDone fires instead
        act(() => {
            mockProvider.emit('responseDone', 'resp-1');
        });

        // Message should be finalized with accumulated delta text
        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].content).toBe('Here is the answer.');
    });

    it('is a no-op when assistantTranscriptComplete already finalized the message', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // Normal flow: delta -> complete -> done
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'Full response', 'resp-1');
        });
        act(() => {
            mockProvider.emit('assistantTranscriptComplete', 'Full response', 'resp-1');
        });

        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].content).toBe('Full response');

        // responseDone fires after — should be a no-op
        act(() => {
            mockProvider.emit('responseDone', 'resp-1');
        });

        // Still exactly one message, unchanged
        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].content).toBe('Full response');
    });

    it('ignores responseDone from a stale response ID', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // Start response resp-2
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'Active response', 'resp-2');
        });

        // Stale responseDone from old response
        act(() => {
            mockProvider.emit('responseDone', 'resp-old');
        });

        // Streaming message should still be active, not finalized
        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].content).toBe('Active response');
    });

    it('creates message from fallback transcript when no deltas fired', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // No assistantTranscriptDelta events fired at all
        // responseDone fires with fallback transcript extracted from response.done payload
        act(() => {
            mockProvider.emit('responseDone', 'resp-1', 'Hello, how can I help you today?');
        });

        // A new message should be created from the fallback transcript
        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].role).toBe('assistant');
        expect(result.current.transcriptMessages[0].content).toBe('Hello, how can I help you today?');
    });

    it('prefers accumulated deltas over fallback transcript', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // Deltas fire normally
        act(() => {
            mockProvider.emit('assistantTranscriptDelta', 'Delta text here', 'resp-1');
        });

        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].content).toBe('Delta text here');

        // responseDone fires with a different fallback transcript
        act(() => {
            mockProvider.emit('responseDone', 'resp-1', 'Different fallback text');
        });

        // Should finalize with the accumulated delta text, NOT the fallback
        expect(result.current.transcriptMessages).toHaveLength(1);
        expect(result.current.transcriptMessages[0].content).toBe('Delta text here');
    });

    it('ignores empty fallback transcript', async () => {
        const { result } = renderHook(() => useVoiceChat());
        await startAndSetup(result);

        // responseDone with empty fallback
        act(() => {
            mockProvider.emit('responseDone', 'resp-1', '   ');
        });

        // No message should be created
        expect(result.current.transcriptMessages).toHaveLength(0);
    });
});

// ============================================================
// SESSION SYNC (from main)
// ============================================================

describe('session sync', () => {
    it('syncs transcript messages when sessionId changes', async () => {
        const firstSessionMessages = [createMessage('s1-msg', 'session one message')];
        const secondSessionMessages = [createMessage('s2-msg', 'session two message')];

        const { result, rerender } = renderHook(
            ({ sessionId, messages }) =>
                useVoiceChat({
                    sessionId,
                    initialTranscriptMessages: messages,
                }),
            {
                initialProps: {
                    sessionId: 'session-1',
                    messages: firstSessionMessages,
                },
            }
        );

        expect(result.current.transcriptMessages[0]?.id).toBe('s1-msg');

        rerender({
            sessionId: 'session-2',
            messages: secondSessionMessages,
        });

        await waitFor(() => {
            expect(result.current.transcriptMessages[0]?.id).toBe('s2-msg');
            expect(result.current.transcriptMessages[0]?.content).toBe('session two message');
        });
    });

    it('clears transcript when parent resets messages to empty', async () => {
        const initialMessages = [createMessage('msg-1', 'hello')];

        const { result, rerender } = renderHook(
            ({ messages }) =>
                useVoiceChat({
                    sessionId: 'session-1',
                    initialTranscriptMessages: messages,
                }),
            {
                initialProps: { messages: initialMessages },
            }
        );

        expect(result.current.transcriptMessages).toHaveLength(1);

        rerender({ messages: [] });

        await waitFor(() => {
            expect(result.current.transcriptMessages).toEqual([]);
        });
    });
});
