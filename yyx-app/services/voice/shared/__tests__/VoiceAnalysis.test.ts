/**
 * VoiceAnalysis Tests
 *
 * Unit tests for the pure analysis functions extracted from OpenAIRealtimeProvider:
 * - isLikelyEcho: echo detection comparing user transcript to last assistant speech
 * - extractTranscriptFromResponse: fallback transcript extraction from response.done payload
 */

import { isLikelyEcho, extractTranscriptFromResponse } from '../VoiceAnalysis';

// ============================================================
// isLikelyEcho
// ============================================================

describe('isLikelyEcho', () => {
    // --- Returns false (not echo) ---

    it('returns false when transcript is empty', () => {
        expect(isLikelyEcho('', 'Hello there!', 500)).toBe(false);
    });

    it('returns false when lastAssistantTranscript is empty', () => {
        expect(isLikelyEcho('Hello there!', '', 500)).toBe(false);
    });

    it('returns false when time since audio is beyond the 2s window', () => {
        expect(isLikelyEcho('Hello there!', 'Hello there!', 2500)).toBe(false);
    });

    it('returns false for short utterances even if they match', () => {
        // "you" appears in "Here is a recipe for you" but is only 3 chars
        expect(isLikelyEcho('you', 'Here is a recipe for you', 500)).toBe(false);
    });

    it('returns false for "yes" even within time window', () => {
        expect(isLikelyEcho('yes', 'Yes, I can help with that!', 100)).toBe(false);
    });

    it('returns false for 7-char utterances (just below threshold)', () => {
        expect(isLikelyEcho('ok sure', 'ok sure, let me find that', 500)).toBe(false);
    });

    it('returns false when transcript does not match assistant text', () => {
        expect(isLikelyEcho('I want pasta', 'Here is a chicken recipe for you', 500)).toBe(false);
    });

    it('returns false at exactly 2000ms (boundary — just past window)', () => {
        // timeSinceAudioDoneMs > 2000 returns false, so 2000 should NOT return false
        // Actually, the check is > 2000 so 2000 is within the window
        expect(isLikelyEcho('Here is a great pasta recipe', 'Here is a great pasta recipe', 2000)).toBe(true);
    });

    it('returns false at 2001ms (just past window)', () => {
        expect(isLikelyEcho('Here is a great pasta recipe', 'Here is a great pasta recipe', 2001)).toBe(false);
    });

    // --- Returns true (echo detected) ---

    it('returns true when user transcript is a substring of assistant speech', () => {
        expect(isLikelyEcho(
            'a great pasta recipe',
            'Here is a great pasta recipe for you!',
            500,
        )).toBe(true);
    });

    it('returns true when assistant speech is a substring of user transcript', () => {
        expect(isLikelyEcho(
            'Here is a great pasta recipe for you!',
            'a great pasta recipe',
            500,
        )).toBe(true);
    });

    it('returns true for exact match within time window', () => {
        expect(isLikelyEcho(
            'I found three recipes!',
            'I found three recipes!',
            1000,
        )).toBe(true);
    });

    it('is case-insensitive', () => {
        expect(isLikelyEcho(
            'I FOUND THREE RECIPES',
            'i found three recipes',
            500,
        )).toBe(true);
    });

    it('trims whitespace before comparison', () => {
        expect(isLikelyEcho(
            '  I found three recipes  ',
            'I found three recipes',
            500,
        )).toBe(true);
    });

    it('detects echo at exactly 8 chars (minimum threshold)', () => {
        expect(isLikelyEcho('12345678', '12345678 and more', 500)).toBe(true);
    });

    it('detects echo just after audio playback (0ms)', () => {
        expect(isLikelyEcho(
            'Here is the recipe',
            'Here is the recipe for you',
            0,
        )).toBe(true);
    });
});

// ============================================================
// extractTranscriptFromResponse
// ============================================================

describe('extractTranscriptFromResponse', () => {
    it('returns null for null response', () => {
        expect(extractTranscriptFromResponse(null)).toBeNull();
    });

    it('returns null for undefined response', () => {
        expect(extractTranscriptFromResponse(undefined)).toBeNull();
    });

    it('returns null when response has no output array', () => {
        expect(extractTranscriptFromResponse({ status: 'completed' })).toBeNull();
    });

    it('returns null when output is not an array', () => {
        expect(extractTranscriptFromResponse({ output: 'not-an-array' })).toBeNull();
    });

    it('returns null for empty output array', () => {
        expect(extractTranscriptFromResponse({ output: [] })).toBeNull();
    });

    it('returns null when output items are not assistant messages', () => {
        expect(extractTranscriptFromResponse({
            output: [
                { type: 'function_call', name: 'search_recipes' },
                { type: 'message', role: 'user', content: [{ transcript: 'hello' }] },
            ],
        })).toBeNull();
    });

    it('returns null when assistant message has no content array', () => {
        expect(extractTranscriptFromResponse({
            output: [
                { type: 'message', role: 'assistant' },
            ],
        })).toBeNull();
    });

    it('returns null when content parts have no transcript field', () => {
        expect(extractTranscriptFromResponse({
            output: [{
                type: 'message',
                role: 'assistant',
                content: [{ type: 'audio', data: 'base64...' }],
            }],
        })).toBeNull();
    });

    it('extracts transcript from a single audio content part', () => {
        const response = {
            output: [{
                type: 'message',
                role: 'assistant',
                content: [{
                    type: 'audio',
                    transcript: 'Hello, how can I help you today?',
                }],
            }],
        };

        expect(extractTranscriptFromResponse(response)).toBe(
            'Hello, how can I help you today?',
        );
    });

    it('joins transcripts from multiple content parts', () => {
        const response = {
            output: [{
                type: 'message',
                role: 'assistant',
                content: [
                    { type: 'audio', transcript: 'I found 3 recipes.' },
                    { type: 'audio', transcript: 'Tap a card to see details.' },
                ],
            }],
        };

        expect(extractTranscriptFromResponse(response)).toBe(
            'I found 3 recipes. Tap a card to see details.',
        );
    });

    it('extracts transcripts across multiple output items', () => {
        const response = {
            output: [
                {
                    type: 'message',
                    role: 'assistant',
                    content: [{ transcript: 'Part one.' }],
                },
                { type: 'function_call', name: 'search_recipes' },
                {
                    type: 'message',
                    role: 'assistant',
                    content: [{ transcript: 'Part two.' }],
                },
            ],
        };

        expect(extractTranscriptFromResponse(response)).toBe('Part one. Part two.');
    });

    it('skips non-string transcript values', () => {
        const response = {
            output: [{
                type: 'message',
                role: 'assistant',
                content: [
                    { transcript: 123 },
                    { transcript: 'Valid text.' },
                    { transcript: null },
                ],
            }],
        };

        expect(extractTranscriptFromResponse(response)).toBe('Valid text.');
    });

    it('skips empty string transcripts', () => {
        const response = {
            output: [{
                type: 'message',
                role: 'assistant',
                content: [
                    { transcript: '' },
                    { transcript: 'Actual content.' },
                ],
            }],
        };

        // Empty string is falsy so it's skipped by the `if (part.transcript && ...)` guard
        expect(extractTranscriptFromResponse(response)).toBe('Actual content.');
    });
});
