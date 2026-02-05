/**
 * Deepgram Speech-to-Text Provider
 * Uses Nova-2 model with built-in VAD for utterance detection
 */

import type { STTConfig, STTProvider } from "./types.ts";

export class DeepgramSTTProvider implements STTProvider {
  private ws: WebSocket | null = null;
  private startTime: number | null = null;
  private onTranscriptCallback:
    | ((text: string, isFinal: boolean) => void)
    | null = null;
  private onUtteranceEndCallback: (() => void) | null = null;

  async connect(config: STTConfig): Promise<void> {
    const apiKey = Deno.env.get("DEEPGRAM_API_KEY");
    if (!apiKey) {
      throw new Error("DEEPGRAM_API_KEY not configured");
    }

    // Build Deepgram WebSocket URL with parameters
    const url = new URL("wss://api.deepgram.com/v1/listen");
    url.searchParams.set("model", "nova-2");
    url.searchParams.set("language", config.language);
    url.searchParams.set("encoding", config.encoding);
    url.searchParams.set("sample_rate", config.sampleRate.toString());
    url.searchParams.set("channels", "1");
    url.searchParams.set("utterance_end_ms", config.utteranceEndMs.toString());
    url.searchParams.set("vad_events", "true");
    url.searchParams.set("punctuate", "true");
    url.searchParams.set("smart_format", "true");
    // Enable interim results so Deepgram can emit UtteranceEnd events reliably.
    url.searchParams.set("interim_results", "true");

    console.log("[Deepgram] Connecting to:", url.toString());

    // Use Sec-WebSocket-Protocol header for authentication
    // Deepgram accepts 'token' and API key as subprotocols
    this.ws = new WebSocket(url.toString(), ["token", apiKey]);

    // Ensure binary data is handled as ArrayBuffer
    this.ws.binaryType = "arraybuffer";

    // Wait for connection to open
    await new Promise<void>((resolve, reject) => {
      if (!this.ws) {
        reject(new Error("WebSocket not initialized"));
        return;
      }

      this.ws.onopen = () => {
        console.log("[Deepgram] Connected");
        this.startTime = Date.now();
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error("[Deepgram] Connection error:", error);
        reject(new Error("Failed to connect to Deepgram"));
      };

      // Set up message handler
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error("[Deepgram] Failed to parse message:", error);
        }
      };

      this.ws.onclose = (event) => {
        console.log(
          `[Deepgram] Connection closed (code: ${event.code}, reason: ${
            event.reason || "n/a"
          })`,
        );
      };
    });
  }

  onTranscript(callback: (text: string, isFinal: boolean) => void): void {
    this.onTranscriptCallback = callback;
  }

  onUtteranceEnd(callback: () => void): void {
    this.onUtteranceEndCallback = callback;
  }

  private audioChunkCount = 0;

  sendAudio(chunk: Uint8Array): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
      this.audioChunkCount++;
      // Log every 50 chunks (roughly every 3 seconds at 4096 buffer size)
      if (this.audioChunkCount % 50 === 0) {
        console.log(
          `[Deepgram] Sent ${this.audioChunkCount} audio chunks (${chunk.length} bytes each)`,
        );
      }
    } else {
      console.warn("[Deepgram] Cannot send audio - WebSocket not open");
    }
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      // Send close message to flush any remaining audio
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "CloseStream" }));
      }

      this.ws.close();
      this.ws = null;
    }
  }

  getDurationSeconds(): number {
    if (!this.startTime) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  getCost(): number {
    const durationMinutes = this.getDurationSeconds() / 60;
    return durationMinutes * 0.0043; // $0.0043 per minute for Nova-2
  }

  private handleMessage(data: any): void {
    // Log all message types for debugging
    console.log(
      "[Deepgram] Received message type:",
      data.type,
      JSON.stringify(data).substring(0, 200),
    );

    if (data.type === "Results") {
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      const isFinal = data.is_final === true;
      const speechFinal = data.speech_final === true;

      if (transcript && this.onTranscriptCallback) {
        // speech_final indicates end of a natural speech segment
        // is_final indicates the API won't update this audio segment
        const shouldProcess = isFinal || speechFinal;
        console.log(
          `[Deepgram] Transcript (is_final: ${isFinal}, speech_final: ${speechFinal}):`,
          transcript,
        );
        this.onTranscriptCallback(transcript, shouldProcess);
      } else if (isFinal || speechFinal) {
        // No transcript but speech ended - might trigger utterance end
        console.log(
          "[Deepgram] Results received but no transcript text (speech_final:",
          speechFinal,
          ")",
        );
      }
    } else if (data.type === "UtteranceEnd") {
      console.log("[Deepgram] Utterance end detected");
      if (this.onUtteranceEndCallback) {
        this.onUtteranceEndCallback();
      }
    } else if (data.type === "Metadata") {
      console.log("[Deepgram] Metadata received");
    } else if (data.type === "SpeechStarted") {
      console.log("[Deepgram] Speech started detected");
    } else {
      console.log("[Deepgram] Unknown message type:", data.type);
    }
  }
}
