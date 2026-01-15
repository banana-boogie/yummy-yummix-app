import {
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
  MediaStreamTrack,
} from "react-native-webrtc";
import { supabase } from "@/lib/supabase";
import { Platform } from "react-native";
import InCallManager from "react-native-incall-manager";
import { buildSystemPrompt, detectGoodbye, InactivityTimer } from "../shared/VoiceUtils";
import type {
  VoiceAssistantProvider,
  VoiceStatus,
  VoiceEvent,
  ProviderConfig,
  ConversationContext,
  UserContext,
  RecipeContext,
  QuotaInfo,
} from "../types";

export class OpenAIRealtimeProvider implements VoiceAssistantProvider {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private status: VoiceStatus = "idle";
  private sessionId: string | null = null;
  private sessionStartTime: number | null = null;
  private sessionTimeoutId: NodeJS.Timeout | null = null;
  private inactivityTimer = new InactivityTimer(30000); // 30 seconds
  private eventListeners: Map<VoiceEvent, Set<Function>> = new Map();
  private currentContext: ConversationContext | null = null;
  private dataChannelReady: boolean = false;
  private pendingEvents: any[] = [];
  // Token tracking for cost calculation (separated by type for accurate pricing)
  private sessionInputTokens: number = 0;
  private sessionOutputTokens: number = 0;
  private sessionInputTextTokens: number = 0;
  private sessionInputAudioTokens: number = 0;
  private sessionOutputTextTokens: number = 0;
  private sessionOutputAudioTokens: number = 0;

  async initialize(config: ProviderConfig): Promise<any> {
    this.setStatus("connecting");

    try {
      // 1. Create peer connection
      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // 2. Add local audio track (microphone) with audio configuration
      const stream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      stream.getTracks().forEach((track) => {
        this.pc!.addTrack(track, stream);
      });

      // 2b. Monitor connection state
      this.pc.onconnectionstatechange = () => {
        console.log("[OpenAI] Connection state:", this.pc?.connectionState);
        if (this.pc?.connectionState === "failed") {
          this.emit("error", new Error("WebRTC connection failed"));
          this.setStatus("error");
        } else if (this.pc?.connectionState === "connected") {
          console.log("[OpenAI] WebRTC connected successfully");
        }
      };

      this.pc.oniceconnectionstatechange = () => {
        console.log(
          "[OpenAI] ICE connection state:",
          this.pc?.iceConnectionState,
        );
        if (this.pc?.iceConnectionState === "failed") {
          this.emit("error", new Error("ICE connection failed"));
          this.setStatus("error");
        }
      };

      // 3. Set up data channel for events
      this.dc = this.pc.createDataChannel("oai-events");

      this.dc.onopen = () => {
        console.log("[OpenAI] Data channel OPEN - ready to send events");
        this.dataChannelReady = true;

        // Send any pending events
        while (this.pendingEvents.length > 0) {
          const event = this.pendingEvents.shift();
          this.sendEvent(event);
        }
      };

      this.dc.onclose = () => {
        console.log("[OpenAI] Data channel CLOSED");
        this.dataChannelReady = false;
      };

      this.dc.onerror = (err) => {
        console.error("[OpenAI] Data channel ERROR:", err);
        this.emit("error", new Error("Data channel error"));
      };

      this.dc.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log("[OpenAI] Received event:", message.type);
        this.handleServerMessage(message);
      };

      // 4. Get Ephemeral Token from Backend (and quota info)
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const backendResponse = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL}/start-voice-session`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}), // Empty body to trigger token generation
        },
      );

      if (!backendResponse.ok) {
        const errorData = await backendResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to start voice session");
      }

      const data = await backendResponse.json();
      this.sessionId = data.sessionId;
      const ephemeralToken = data.ephemeralToken;

      // 5. Create Offer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // 6. Connect to OpenAI Realtime API directly using Ephemeral Token
      console.log(
        "[OpenAI] Connecting to Realtime API with ephemeral token...",
      );
      const openaiResponse = await fetch(
        "https://api.openai.com/v1/realtime?model=gpt-realtime-mini",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ephemeralToken}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        },
      );

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        throw new Error(`OpenAI Connection Failed: ${errorText}`);
      }

      const answerSdp = await openaiResponse.text();

      await this.pc.setRemoteDescription(
        new RTCSessionDescription({ type: "answer", sdp: answerSdp }),
      );

      // 7. Handle incoming audio with proper volume configuration
      this.pc.ontrack = (event) => {
        console.log("[OpenAI] Receiving audio stream");
        const [remoteStream] = event.streams;

        if (remoteStream) {
          // Audio playback is handled automatically by WebRTC
          // Volume is controlled by device volume settings
          console.log(
            "[OpenAI] Remote audio track active, tracks:",
            remoteStream.getTracks().length,
          );

          // Enable audio tracks explicitly
          remoteStream.getAudioTracks().forEach((track) => {
            track.enabled = true;
            console.log("[OpenAI] Audio track enabled:", track.id);
          });
        }
      };

      this.setStatus("idle");
      return data;
    } catch (error) {
      console.error("[OpenAI] Initialize error:", error);
      this.setStatus("error");
      this.emit("error", error);
      throw error;
    }
  }

  async startConversation(context: ConversationContext): Promise<void> {
    this.currentContext = context;
    // Don't start timer yet - wait until session.updated event confirms ready
    this.setStatus("connecting"); // Stay in connecting until session is ready

    // Route audio to loudspeaker (fixes earpiece issue)
    InCallManager.start({ media: "audio", ringback: "" });
    InCallManager.setForceSpeakerphoneOn(true);
    console.log("[OpenAI] Audio routed to loudspeaker");

    // Start inactivity timer (will auto-end if no speech for 30 seconds)
    this.inactivityTimer.reset(() => {
      console.log("[OpenAI] Inactivity timeout - no speech for 30 seconds, ending session");
      this.stopConversation();
    });

    // Send session configuration with context via data channel
    const systemPrompt = buildSystemPrompt(context);

    console.log("[OpenAI] Sending session update...");
    this.sendEvent({
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions: systemPrompt,
        voice: "marin", // Female voice that works for all languages
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 800,
        },
      },
    });

    // Initial greeting removed to save costs - UI shows text bubble instead
  }

  stopConversation(): void {
    console.log("[OpenAI] stopConversation called");

    // Clear timers
    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId);
      this.sessionTimeoutId = null;
    }

    this.inactivityTimer.clear();

    if (this.sessionStartTime) {
      const durationSeconds = (Date.now() - this.sessionStartTime) / 1000;
      console.log(`[OpenAI] Session duration: ${durationSeconds.toFixed(2)}s`);

      // Fire and forget - don't await to keep UI responsive
      this.updateSessionDuration(durationSeconds).catch((err) => {
        console.error(
          "[OpenAI] Failed to update session in stopConversation:",
          err,
        );
      });

      this.sessionStartTime = null;
    }

    // CRITICAL: Close WebRTC connections to actually end the session
    if (this.dc) {
      console.log("[OpenAI] Closing data channel");
      this.dc.close();
      this.dc = null;
      this.dataChannelReady = false;
    }

    if (this.pc) {
      console.log("[OpenAI] Closing peer connection");
      this.pc.close();
      this.pc = null;
    }

    // Clear pending events
    this.pendingEvents = [];

    // Stop audio routing
    InCallManager.stop();
    console.log("[OpenAI] Audio routing stopped");

    // Reset token counters for next session
    this.sessionInputTokens = 0;
    this.sessionOutputTokens = 0;
    this.sessionInputTextTokens = 0;
    this.sessionInputAudioTokens = 0;
    this.sessionOutputTextTokens = 0;
    this.sessionOutputAudioTokens = 0;

    this.setStatus("idle");
  }

  setContext(userContext: UserContext, recipeContext?: RecipeContext): void {
    if (!this.currentContext) {
      this.currentContext = { userContext, recipeContext };
    } else {
      this.currentContext.userContext = userContext;
      if (recipeContext) {
        this.currentContext.recipeContext = recipeContext;
      }
    }

    // Update session instructions mid-conversation
    if (this.dc && this.dc.readyState === "open") {
      const systemPrompt = buildSystemPrompt(this.currentContext);
      this.sendEvent({
        type: "session.update",
        session: { instructions: systemPrompt },
      });
    }
  }

  on(event: VoiceEvent, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: VoiceEvent, callback: Function): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  getStatus(): VoiceStatus {
    return this.status;
  }

  async getRemainingQuota(): Promise<QuotaInfo> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL}/start-voice-session`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();

    return {
      remainingMinutes: parseFloat(data.remainingMinutes),
      minutesUsed: parseFloat(data.minutesUsed),
      quotaLimit: data.quotaLimit,
      warning: data.warning,
    };
  }

  async destroy(): Promise<void> {
    this.stopConversation();
    this.dc?.close();
    this.pc?.close();
    this.eventListeners.clear();
  }

  // Private methods

  private setStatus(status: VoiceStatus): void {
    this.status = status;
    this.emit("statusChange", status);
  }

  private emit(event: VoiceEvent, ...args: any[]): void {
    this.eventListeners.get(event)?.forEach((callback) => callback(...args));
  }

  private sendEvent(event: any): void {
    if (this.dataChannelReady && this.dc && this.dc.readyState === "open") {
      this.dc.send(JSON.stringify(event));
      console.log("[OpenAI] Sent event:", event.type);
    } else {
      // Queue event until data channel opens
      console.log("[OpenAI] Queueing event (channel not ready):", event.type);
      this.pendingEvents.push(event);
    }
  }

  private handleServerMessage(message: any): void {
    console.log("[OpenAI] Event:", message.type);

    switch (message.type) {
      // Session events
      case "session.created":
        console.log("[OpenAI] Session created");
        break;

      case "session.updated":
        console.log(
          "[OpenAI] Session configuration applied - ready for user input",
        );
        // Start the session timer NOW (not in startConversation)
        if (!this.sessionStartTime) {
          this.sessionStartTime = Date.now();
          console.log("[OpenAI] Session timer started");
        }
        this.setStatus("listening"); // Now we're truly ready
        break;

      // Input audio buffer events
      case "input_audio_buffer.speech_started":
        console.log("[OpenAI] User started speaking");
        this.setStatus("listening");
        // Reset inactivity timer when user speaks
        this.inactivityTimer.reset(() => {
          console.log("[OpenAI] Inactivity timeout - no speech for 30 seconds, ending session");
          this.stopConversation();
        });
        break;

      case "input_audio_buffer.speech_stopped":
        console.log("[OpenAI] User stopped speaking");
        this.setStatus("processing");
        break;

      case "input_audio_buffer.committed":
        console.log("[OpenAI] Audio committed for processing");
        break;

      // Conversation item events
      case "conversation.item.created":
        if (message.item.type === "message" && message.item.role === "user") {
          // User message created (with transcript if available)
          const transcript = message.item.content?.[0]?.transcript || "";
          if (transcript) {
            console.log(
              "[OpenAI] User transcript from conversation.item.created:",
              transcript,
            );
            this.emit("transcript", transcript);

            // Check for goodbye (fallback if input_audio_transcription.completed doesn't fire)
            if (detectGoodbye(transcript)) {
              console.log(
                "[OpenAI] Goodbye detected in conversation.item.created",
              );
              setTimeout(() => {
                this.stopConversation();
              }, 2000);
            }
          }
        }
        break;

      case "conversation.item.input_audio_transcription.completed":
        // User's speech transcribed
        console.log(
          "[OpenAI] User transcript from input_audio_transcription.completed:",
          message.transcript,
        );
        this.emit("transcript", message.transcript);

        // Check if user said goodbye
        if (detectGoodbye(message.transcript)) {
          console.log(
            "[OpenAI] Goodbye detected in input_audio_transcription.completed",
          );
          // Give a brief moment for AI to respond, then end
          setTimeout(() => {
            this.stopConversation();
          }, 2000); // 2 seconds for AI to say goodbye back
        }
        break;

      // Response events
      case "response.created":
        console.log("[OpenAI] Response generation started");
        this.setStatus("processing");
        break;

      case "response.output_item.added":
        console.log("[OpenAI] Output item added");
        break;

      case "response.content_part.added":
        console.log("[OpenAI] Content part added");
        break;

      case "response.audio_transcript.delta":
        // Streaming transcript of assistant's response
        const delta = message.delta;
        if (delta) {
          this.emit("transcript", delta); // Can show what AI is saying
        }
        break;

      case "response.audio.delta":
        // Audio chunk received (played automatically by WebRTC)
        this.setStatus("speaking");
        break;

      case "response.audio_transcript.done":
        // Complete transcript of what AI said
        const fullTranscript = message.transcript;
        if (fullTranscript) {
          this.emit("response", { text: fullTranscript });
        }
        break;

      case "response.output_item.done":
        // Output item complete
        console.log("[OpenAI] Output item complete");
        break;

      case "response.content_part.done":
        // Content part complete
        console.log("[OpenAI] Content part complete");
        break;

      case "response.done":
        // Response complete - capture token usage if available
        console.log("[OpenAI] Response complete");

        // Extract token usage from response
        if (message.response?.usage) {
          const usage = message.response.usage;
          this.sessionInputTokens += usage.input_tokens || 0;
          this.sessionOutputTokens += usage.output_tokens || 0;

          // Track detailed breakdowns separately for accurate pricing
          if (usage.input_token_details) {
            this.sessionInputTextTokens +=
              usage.input_token_details.text_tokens || 0;
            this.sessionInputAudioTokens +=
              usage.input_token_details.audio_tokens || 0;
          }
          if (usage.output_token_details) {
            this.sessionOutputTextTokens +=
              usage.output_token_details.text_tokens || 0;
            this.sessionOutputAudioTokens +=
              usage.output_token_details.audio_tokens || 0;
          }

          console.log(
            `[OpenAI] Token usage - Input: ${this.sessionInputTokens} (${this.sessionInputTextTokens} text, ${this.sessionInputAudioTokens} audio), ` +
              `Output: ${this.sessionOutputTokens} (${this.sessionOutputTextTokens} text, ${this.sessionOutputAudioTokens} audio)`,
          );
        }

        this.setStatus("listening");
        break;

      // Rate limits
      case "rate_limits.updated":
        console.log("[OpenAI] Rate limits:", message.rate_limits);
        break;

      // Errors
      case "error":
        console.error("[OpenAI] Error:", message.error);
        this.emit("error", new Error(message.error.message || "Unknown error"));
        this.setStatus("error");
        break;

      default:
        console.log("[OpenAI] Unhandled event:", message.type);
    }
  }

  private async updateSessionDuration(durationSeconds: number): Promise<void> {
    if (!this.sessionId) {
      console.warn("[OpenAI] No session ID to update");
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        console.error("[OpenAI] No auth session for DB update");
        return;
      }

      // If no tokens captured, estimate from duration (assume all audio tokens)
      if (this.sessionInputTokens === 0 && this.sessionOutputTokens === 0) {
        const minutes = durationSeconds / 60;
        this.sessionInputTokens = Math.ceil(minutes * 750);
        this.sessionOutputTokens = Math.ceil(minutes * 750);
        this.sessionInputAudioTokens = this.sessionInputTokens;
        this.sessionOutputAudioTokens = this.sessionOutputTokens;
        console.warn(
          `[OpenAI] No token data received, using estimation:\n` +
            `  ${durationSeconds}s → ${this.sessionInputTokens} input + ${this.sessionOutputTokens} output tokens (estimated as audio)`,
        );
      }

      // Calculate cost with correct pricing for text vs audio tokens
      // Text: $0.60/1M input, $2.40/1M output
      // Audio: $10/1M input, $20/1M output
      const costUsd =
        this.sessionInputTextTokens * (0.6 / 1_000_000) +
        this.sessionInputAudioTokens * (10 / 1_000_000) +
        this.sessionOutputTextTokens * (2.4 / 1_000_000) +
        this.sessionOutputAudioTokens * (20 / 1_000_000);

      console.log(
        `[OpenAI] Updating session ${this.sessionId}:\n` +
          `  Duration: ${durationSeconds.toFixed(2)}s\n` +
          `  Input tokens: ${this.sessionInputTokens} (${this.sessionInputTextTokens} text @ $0.60/1M, ${this.sessionInputAudioTokens} audio @ $10/1M)\n` +
          `  Output tokens: ${this.sessionOutputTokens} (${this.sessionOutputTextTokens} text @ $2.40/1M, ${this.sessionOutputAudioTokens} audio @ $20/1M)\n` +
          `  Cost: $${costUsd.toFixed(6)}`,
      );

      const { error } = await supabase
        .from("ai_voice_sessions")
        .update({
          status: "completed",
          provider_type: "openai-realtime",
          duration_seconds: durationSeconds,
          input_tokens: this.sessionInputTokens,
          output_tokens: this.sessionOutputTokens,
          input_text_tokens: this.sessionInputTextTokens,
          input_audio_tokens: this.sessionInputAudioTokens,
          output_text_tokens: this.sessionOutputTextTokens,
          output_audio_tokens: this.sessionOutputAudioTokens,
          cost_usd: costUsd,
          completed_at: new Date().toISOString(),
        })
        .eq("id", this.sessionId);

      if (error) {
        console.error("[OpenAI] Failed to update session:", error);
      } else {
        console.log("[OpenAI] Session updated successfully");
      }
    } catch (error) {
      console.error("[OpenAI] Error updating session duration:", error);
    }
  }
}
