/**
 * useSpeechRecognition Tests
 *
 * Tests for the speech recognition hook covering:
 * - Mic press starts/stops recognition
 * - Permission denied flow
 * - Speech results update transcript
 * - Stop-and-guard prevents late results
 * - Error handling
 */

import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useSpeechRecognition } from '../useSpeechRecognition';

// Capture event handlers registered by the hook
type EventHandler = (...args: any[]) => void;
const eventHandlers: Record<string, EventHandler> = {};

const mockUseSpeechRecognitionEvent = useSpeechRecognitionEvent as jest.Mock;
const mockRequestPermissions = ExpoSpeechRecognitionModule.requestPermissionsAsync as jest.Mock;
const mockStart = ExpoSpeechRecognitionModule.start as jest.Mock;
const mockStop = ExpoSpeechRecognitionModule.stop as jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
    mockUseSpeechRecognitionEvent.mockReset();
    mockRequestPermissions.mockReset();
    mockStart.mockReset();
    mockStop.mockReset();
    // Reset captured handlers
    Object.keys(eventHandlers).forEach(k => delete eventHandlers[k]);

    // Capture each event registration
    mockUseSpeechRecognitionEvent.mockImplementation((event: string, handler: EventHandler) => {
        eventHandlers[event] = handler;
    });

    // Default: permission granted
    mockRequestPermissions.mockResolvedValue({ granted: true });
});

function renderSpeechHook(overrides?: Partial<Parameters<typeof useSpeechRecognition>[0]>) {
    const onTranscript = jest.fn();
    return {
        onTranscript,
        ...renderHook(() =>
            useSpeechRecognition({
                language: 'en',
                onTranscript,
                ...overrides,
            })
        ),
    };
}

describe('useSpeechRecognition', () => {
    // ============================================================
    // INITIAL STATE
    // ============================================================

    describe('initial state', () => {
        it('starts not listening', () => {
            const { result } = renderSpeechHook();
            expect(result.current.isListening).toBe(false);
        });

        it('registers result, end, and error event handlers', () => {
            renderSpeechHook();
            expect(eventHandlers.result).toBeDefined();
            expect(eventHandlers.end).toBeDefined();
            expect(eventHandlers.error).toBeDefined();
        });
    });

    // ============================================================
    // MIC PRESS — START
    // ============================================================

    describe('handleMicPress — start', () => {
        it('requests permissions and starts recognition', async () => {
            const { result } = renderSpeechHook();

            await act(async () => {
                await result.current.handleMicPress();
            });

            expect(mockRequestPermissions).toHaveBeenCalled();
            expect(mockStart).toHaveBeenCalledWith({
                lang: 'en-US',
                interimResults: true,
            });
            expect(result.current.isListening).toBe(true);
        });

        it('uses es-MX locale for Spanish', async () => {
            const { result } = renderSpeechHook({ language: 'es' });

            await act(async () => {
                await result.current.handleMicPress();
            });

            expect(mockStart).toHaveBeenCalledWith({
                lang: 'es-MX',
                interimResults: true,
            });
        });

        it('shows alert and does not start when permission denied', async () => {
            mockRequestPermissions.mockResolvedValue({ granted: false });
            const alertSpy = jest.spyOn(Alert, 'alert');
            const { result } = renderSpeechHook();

            await act(async () => {
                await result.current.handleMicPress();
            });

            expect(alertSpy).toHaveBeenCalled();
            expect(mockStart).not.toHaveBeenCalled();
            expect(result.current.isListening).toBe(false);
        });
    });

    // ============================================================
    // MIC PRESS — STOP
    // ============================================================

    describe('handleMicPress — stop', () => {
        it('stops recognition when already listening', async () => {
            const { result } = renderSpeechHook();

            // Start first
            await act(async () => {
                await result.current.handleMicPress();
            });
            expect(result.current.isListening).toBe(true);

            // Press again to stop
            await act(async () => {
                await result.current.handleMicPress();
            });

            expect(mockStop).toHaveBeenCalled();
            expect(result.current.isListening).toBe(false);
        });
    });

    describe('handleMicPress — unexpected failures', () => {
        it('handles permission request errors gracefully', async () => {
            mockRequestPermissions.mockRejectedValue(new Error('permission failure'));
            const alertSpy = jest.spyOn(Alert, 'alert');
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            const { result } = renderSpeechHook();

            await act(async () => {
                await expect(result.current.handleMicPress()).resolves.toBeUndefined();
            });

            expect(mockStart).not.toHaveBeenCalled();
            expect(result.current.isListening).toBe(false);
            expect(alertSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });

        it('handles start errors gracefully', async () => {
            mockStart.mockImplementation(() => {
                throw new Error('start failure');
            });
            const alertSpy = jest.spyOn(Alert, 'alert');
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            const { result } = renderSpeechHook();

            await act(async () => {
                await expect(result.current.handleMicPress()).resolves.toBeUndefined();
            });

            expect(result.current.isListening).toBe(false);
            expect(alertSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });

    // ============================================================
    // SPEECH RESULTS
    // ============================================================

    describe('speech results', () => {
        it('calls onTranscript with recognized text', async () => {
            const { result, onTranscript } = renderSpeechHook();

            await act(async () => {
                await result.current.handleMicPress();
            });

            act(() => {
                eventHandlers.result({ results: [{ transcript: 'hello world' }] });
            });

            expect(onTranscript).toHaveBeenCalledWith('hello world');
        });

        it('ignores empty transcripts', async () => {
            const { onTranscript } = renderSpeechHook();

            act(() => {
                eventHandlers.result({ results: [{ transcript: '' }] });
            });

            expect(onTranscript).not.toHaveBeenCalled();
        });
    });

    // ============================================================
    // STOP AND GUARD
    // ============================================================

    describe('stopAndGuard', () => {
        it('stops recognition and sets isListening to false', async () => {
            const { result } = renderSpeechHook();

            await act(async () => {
                await result.current.handleMicPress();
            });
            expect(result.current.isListening).toBe(true);

            act(() => {
                result.current.stopAndGuard();
            });

            expect(mockStop).toHaveBeenCalled();
            expect(result.current.isListening).toBe(false);
        });

        it('prevents late speech results from calling onTranscript', async () => {
            const { result, onTranscript } = renderSpeechHook();

            await act(async () => {
                await result.current.handleMicPress();
            });

            act(() => {
                result.current.stopAndGuard();
            });

            // Simulate a late result arriving after guard
            act(() => {
                eventHandlers.result({ results: [{ transcript: 'late text' }] });
            });

            expect(onTranscript).not.toHaveBeenCalled();
        });

        it('resets guard when starting a new session', async () => {
            const { result, onTranscript } = renderSpeechHook();

            // Start, guard, start again
            await act(async () => {
                await result.current.handleMicPress();
            });
            act(() => {
                result.current.stopAndGuard();
            });

            // Simulate end event so isListening goes false
            act(() => {
                eventHandlers.end();
            });

            // Start new session
            await act(async () => {
                await result.current.handleMicPress();
            });

            // Results should work again
            act(() => {
                eventHandlers.result({ results: [{ transcript: 'new text' }] });
            });

            expect(onTranscript).toHaveBeenCalledWith('new text');
        });
    });

    // ============================================================
    // ERROR HANDLING
    // ============================================================

    describe('error handling', () => {
        it('sets isListening to false on error', async () => {
            const { result } = renderSpeechHook();

            await act(async () => {
                await result.current.handleMicPress();
            });
            expect(result.current.isListening).toBe(true);

            act(() => {
                eventHandlers.error({ error: 'network' });
            });

            expect(result.current.isListening).toBe(false);
        });

        it('shows alert for permission-denied errors', () => {
            const alertSpy = jest.spyOn(Alert, 'alert');
            renderSpeechHook();

            act(() => {
                eventHandlers.error({ error: 'not-allowed' });
            });

            expect(alertSpy).toHaveBeenCalled();
        });

        it('shows alert for service-not-allowed errors', () => {
            const alertSpy = jest.spyOn(Alert, 'alert');
            renderSpeechHook();

            act(() => {
                eventHandlers.error({ error: 'service-not-allowed' });
            });

            expect(alertSpy).toHaveBeenCalled();
        });

        it('does not show alert for other errors', () => {
            const alertSpy = jest.spyOn(Alert, 'alert');
            renderSpeechHook();

            act(() => {
                eventHandlers.error({ error: 'network' });
            });

            expect(alertSpy).not.toHaveBeenCalled();
        });
    });

    // ============================================================
    // END EVENT
    // ============================================================

    describe('end event', () => {
        it('sets isListening to false when recognition ends', async () => {
            const { result } = renderSpeechHook();

            await act(async () => {
                await result.current.handleMicPress();
            });
            expect(result.current.isListening).toBe(true);

            act(() => {
                eventHandlers.end();
            });

            expect(result.current.isListening).toBe(false);
        });
    });
});
