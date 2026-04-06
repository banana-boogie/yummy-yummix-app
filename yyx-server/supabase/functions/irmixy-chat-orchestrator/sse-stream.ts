/**
 * SSE Stream Utilities
 *
 * Encapsulates ReadableStream creation, SSE encoding, heartbeat/timeout
 * management, and the final Response construction for Server-Sent Events.
 */

import { corsHeaders } from "../_shared/cors.ts";
import { STREAM_TIMEOUT_MS } from "./config.ts";

/** Callback that runs inside the ReadableStream's start(). */
export type StreamBody = (ctx: StreamContext) => Promise<void>;

/** Helpers exposed to the stream body for sending SSE events. */
export interface StreamContext {
  /** Send a JSON-encoded SSE data event. No-ops if the stream is already closed or aborted. */
  send: (data: Record<string, unknown>) => void;
  /** The unified abort signal (fires on client disconnect or explicit cancel). */
  signal: AbortSignal;
}

/**
 * Create an SSE Response that executes `body` inside a ReadableStream.
 *
 * Handles:
 * - TextEncoder lifecycle
 * - Safe enqueue/close (no double-close)
 * - Stream timeout (sends error + closes after STREAM_TIMEOUT_MS of silence)
 * - Wiring the request's AbortSignal to a unified controller
 */
export function createSSEResponse(
  body: StreamBody,
  reqSignal?: AbortSignal,
): Response {
  const encoder = new TextEncoder();

  // Unified abort controller: fires when client disconnects OR stream is cancelled
  const abortController = new AbortController();
  const signal = abortController.signal;
  if (reqSignal) {
    reqSignal.addEventListener("abort", () => abortController.abort(), {
      once: true,
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      let streamTimeoutId: ReturnType<typeof setTimeout> | null = null;
      let streamClosed = false;

      const safeEnqueue = (chunk: Uint8Array) => {
        if (!streamClosed) controller.enqueue(chunk);
      };
      const safeClose = () => {
        if (!streamClosed) {
          streamClosed = true;
          controller.close();
        }
      };

      const resetStreamTimeout = () => {
        if (streamTimeoutId) clearTimeout(streamTimeoutId);
        streamTimeoutId = setTimeout(() => {
          safeEnqueue(
            encoder.encode(
              `data: ${
                JSON.stringify({
                  type: "error",
                  error: "Stream timeout — no data for 30 seconds",
                })
              }\n\n`,
            ),
          );
          safeClose();
        }, STREAM_TIMEOUT_MS);
      };

      const clearStreamTimeout = () => {
        if (streamTimeoutId) {
          clearTimeout(streamTimeoutId);
          streamTimeoutId = null;
        }
      };

      const send = (data: Record<string, unknown>) => {
        if (streamClosed || signal.aborted) return;
        safeEnqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
        resetStreamTimeout();
      };

      try {
        resetStreamTimeout();
        await body({ send, signal });
        clearStreamTimeout();
        safeClose();
      } catch (error) {
        if (signal.aborted) {
          // Client disconnected — nothing to send
          clearStreamTimeout();
          safeClose();
          return;
        }
        send({
          type: "error",
          error: "An unexpected error occurred",
        });
        clearStreamTimeout();
        safeClose();
        // Re-throw so callers can log if needed — but the stream is already
        // closed, so this only surfaces in Deno's unhandled rejection handler.
        throw error;
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
