/**
 * Pure analysis functions used by the voice provider.
 *
 * Extracted here so they can be unit-tested without WebRTC or native mocks.
 */

/** Minimum character length for echo detection — shorter utterances are always real speech. */
const MIN_ECHO_LENGTH = 8;
/** Maximum milliseconds after audio playback ends to consider echo. */
const ECHO_WINDOW_MS = 2000;

/**
 * Detect whether a user transcript is likely echo from the device speaker.
 *
 * Compares the user's transcription against the last assistant transcript
 * within a time window after audio playback ended. Short utterances (< 8 chars)
 * are never flagged — words like "yes", "ok", "you" must not be suppressed.
 */
export function isLikelyEcho(
    transcript: string,
    lastAssistantTranscript: string,
    timeSinceAudioDoneMs: number,
): boolean {
    if (!transcript || !lastAssistantTranscript) return false;
    if (timeSinceAudioDoneMs > ECHO_WINDOW_MS) return false;

    const userLower = transcript.toLowerCase().trim();
    const assistantLower = lastAssistantTranscript.toLowerCase().trim();

    if (userLower.length < MIN_ECHO_LENGTH) return false;

    return assistantLower.includes(userLower) || userLower.includes(assistantLower);
}

/**
 * Extract the full transcript from a `response.done` payload.
 *
 * The response includes `output[]` items; assistant message items have
 * `content[]` parts where audio parts carry a `transcript` field.
 * Returns the joined transcript text, or null if none found.
 */
export function extractTranscriptFromResponse(response: any): string | null {
    if (!response?.output || !Array.isArray(response.output)) return null;

    const parts: string[] = [];
    for (const item of response.output) {
        if (item.type !== "message" || item.role !== "assistant") continue;
        if (!Array.isArray(item.content)) continue;
        for (const part of item.content) {
            if (part.transcript && typeof part.transcript === "string") {
                parts.push(part.transcript);
            }
        }
    }

    return parts.length > 0 ? parts.join(" ") : null;
}
