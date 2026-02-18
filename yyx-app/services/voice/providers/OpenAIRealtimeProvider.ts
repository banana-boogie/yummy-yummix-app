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
import { voiceTools } from "../shared/VoiceToolDefinitions";
import type {
  VoiceAssistantProvider,
  VoiceStatus,
  VoiceEvent,
  VoiceToolCall,
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
  // Function call tracking (keyed by call_id to handle interleaved calls)
  private pendingToolCalls: Map<string, { name: string; args: string }> = new Map();
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
        if (this.pc?.connectionState === "failed") {
          this.emit("error", new Error("WebRTC connection failed"));
          this.setStatus("error");
        }
      };

      this.pc.oniceconnectionstatechange = () => {
        if (this.pc?.iceConnectionState === "failed") {
          this.emit("error", new Error("ICE connection failed"));
          this.setStatus("error");
        }
      };

      // 3. Set up data channel for events
      this.dc = this.pc.createDataChannel("oai-events");

      this.dc.onopen = () => {
        this.dataChannelReady = true;

        // Send any pending events
        while (this.pendingEvents.length > 0) {
          const event = this.pendingEvents.shift();
          this.sendEvent(event);
        }
      };

      this.dc.onclose = () => {
        this.dataChannelReady = false;
      };

      this.dc.onerror = (err) => {
        console.error("[OpenAI] Data channel ERROR:", err);
        this.pendingToolCalls.clear();
        this.emit("error", new Error("Data channel error"));
      };

      this.dc.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleServerMessage(message);
        } catch (e) {
          if (__DEV__) console.error('[OpenAI] Failed to parse data channel message:', e);
        }
      };

      // 4. Get Ephemeral Token from Backend (and quota info)
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const backendResponse = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL}/irmixy-voice-orchestrator`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "start_session" }),
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
        const [remoteStream] = event.streams;

        if (remoteStream) {
          // Enable audio tracks explicitly
          remoteStream.getAudioTracks().forEach((track) => {
            track.enabled = true;
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

    // Start inactivity timer (auto-end if no speech for 30 seconds)
    this.inactivityTimer.reset(() => {
      this.stopConversation();
    });

    // Send session configuration with context via data channel
    const systemPrompt = buildSystemPrompt(context);

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
        tools: voiceTools,
      },
    });

    // Initial greeting removed to save costs - UI shows text bubble instead
  }

  stopConversation(): void {
    // Clear timers
    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId);
      this.sessionTimeoutId = null;
    }

    this.inactivityTimer.clear();

    if (this.sessionStartTime) {
      const durationSeconds = (Date.now() - this.sessionStartTime) / 1000;

      // Fire and forget - don't await to keep UI responsive
      this.updateSessionDuration(durationSeconds).catch((err) => {
        console.error("[OpenAI] Failed to update session:", err);
      });

      this.sessionStartTime = null;
    }

    // CRITICAL: Close WebRTC connections to actually end the session
    if (this.dc) {
      this.dc.close();
      this.dc = null;
      this.dataChannelReady = false;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    // Clear pending events
    this.pendingEvents = [];

    // Stop audio routing
    InCallManager.stop();

    // Reset tool call tracking
    this.pendingToolCalls.clear();

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

  sendToolResult(callId: string, output: string): void {
    // Send the function call output back to OpenAI
    this.sendEvent({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output,
      },
    });
    // Trigger OpenAI to continue (generate spoken response about the tool result)
    this.sendEvent({ type: "response.create" });
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
      `${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL}/irmixy-voice-orchestrator`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "check_quota" }),
      },
    );

    if (!response.ok) {
      throw new Error(`Quota check failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      remainingMinutes: parseFloat(data.remainingMinutes),
      minutesUsed: parseFloat(data.minutesUsed),
      quotaLimit: data.quotaLimit,
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
    } else {
      // Queue event until data channel opens
      this.pendingEvents.push(event);
    }
  }

  private handleServerMessage(message: any): void {
    switch (message.type) {
      // Session events
      case "session.created":
        break;

      case "session.updated":
        // Start the session timer NOW (not in startConversation)
        if (!this.sessionStartTime) {
          this.sessionStartTime = Date.now();
        }
        this.setStatus("listening"); // Now we're truly ready
        break;

      // Input audio buffer events
      case "input_audio_buffer.speech_started":
        this.setStatus("listening");
        // Reset inactivity timer when user speaks
        this.inactivityTimer.reset(() => {
          this.stopConversation();
        });
        break;

      case "input_audio_buffer.speech_stopped":
        this.setStatus("processing");
        break;

      case "input_audio_buffer.committed":
        break;

      // Conversation item events
      case "conversation.item.created":
        if (message.item.type === "message" && message.item.role === "user") {
          // User message created (with transcript if available)
          const transcript = message.item.content?.[0]?.transcript || "";
          if (transcript) {
            this.emit("transcript", transcript);

            // Check for goodbye (fallback if input_audio_transcription.completed doesn't fire)
            if (detectGoodbye(transcript)) {
              setTimeout(() => {
                this.stopConversation();
              }, 2000);
            }
          }
        }
        break;

      case "conversation.item.input_audio_transcription.completed":
        // User's speech transcribed
        this.emit("transcript", message.transcript);
        this.emit("userTranscriptComplete", message.transcript);

        // Check if user said goodbye
        if (detectGoodbye(message.transcript)) {
          // Give a brief moment for AI to respond, then end
          setTimeout(() => {
            this.stopConversation();
          }, 2000); // 2 seconds for AI to say goodbye back
        }
        break;

      // Response events
      case "response.created":
        this.setStatus("processing");
        break;

      case "response.output_item.added":
        // Track function calls when they start (keyed by call_id)
        if (message.item?.type === "function_call" && message.item.call_id) {
          this.pendingToolCalls.set(message.item.call_id, {
            name: message.item.name,
            args: "",
          });
        }
        break;

      case "response.content_part.added":
        break;

      case "response.function_call_arguments.delta":
        // Accumulate function call arguments as they stream in
        if (message.delta && message.call_id) {
          const pending = this.pendingToolCalls.get(message.call_id);
          if (pending) {
            pending.args += message.delta;
          }
        }
        break;

      case "response.function_call_arguments.done":
        // Function call arguments complete — parse and emit
        if (message.call_id) {
          const pending = this.pendingToolCalls.get(message.call_id);
          if (pending) {
            try {
              const args = JSON.parse(pending.args || "{}");
              const toolCall: VoiceToolCall = {
                callId: message.call_id,
                name: pending.name,
                arguments: args,
              };
              this.emit("toolCall", toolCall);
            } catch (e) {
              console.error("[OpenAI] Failed to parse tool call args:", e);
            }
            this.pendingToolCalls.delete(message.call_id);
          }
        }
        break;

      case "response.audio_transcript.delta":
        // Streaming transcript of assistant's response
        if (message.delta) {
          this.emit("transcript", message.delta);
          this.emit("assistantTranscriptDelta", message.delta);
        }
        break;

      case "response.audio.delta":
        // Audio chunk received (played automatically by WebRTC)
        this.setStatus("speaking");
        break;

      case "response.audio_transcript.done":
        // Complete transcript of what AI said
        if (message.transcript) {
          this.emit("response", { text: message.transcript });
          this.emit("assistantTranscriptComplete", message.transcript);
        }
        break;

      case "response.audio.done":
        // AI finished speaking - give user a fresh inactivity window to respond.
        this.inactivityTimer.reset(() => {
          this.stopConversation();
        });
        break;

      case "response.output_item.done":
      case "response.content_part.done":
        break;

      case "response.done":
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

          // Keep token usage log - useful for cost tracking
          console.log(
            `[Voice] Tokens - In: ${this.sessionInputTokens} (${this.sessionInputTextTokens}t/${this.sessionInputAudioTokens}a), ` +
              `Out: ${this.sessionOutputTokens} (${this.sessionOutputTextTokens}t/${this.sessionOutputAudioTokens}a)`,
          );
        }

        // Reset inactivity timer when AI turn fully completes.
        this.inactivityTimer.reset(() => {
          this.stopConversation();
        });
        this.setStatus("listening");
        break;

      // Rate limits
      case "rate_limits.updated":
        break;

      // Errors
      case "error":
        console.error("[OpenAI] Error:", message.error);
        this.emit("error", new Error(message.error.message || "Unknown error"));
        this.setStatus("error");
        break;

      default:
        // Ignore unhandled events silently
        break;
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
      }

      // Calculate cost with correct pricing for text vs audio tokens
      // Text: $0.60/1M input, $2.40/1M output
      // Audio: $10/1M input, $20/1M output
      const costUsd =
        this.sessionInputTextTokens * (0.6 / 1_000_000) +
        this.sessionInputAudioTokens * (10 / 1_000_000) +
        this.sessionOutputTextTokens * (2.4 / 1_000_000) +
        this.sessionOutputAudioTokens * (20 / 1_000_000);

      // Keep cost summary log - useful for monitoring
      console.log(
        `[Voice] Session: ${durationSeconds.toFixed(1)}s, Cost: $${costUsd.toFixed(4)}`,
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
      }
    } catch (error) {
      console.error("[OpenAI] Error updating session duration:", error);
    }
  }
}
