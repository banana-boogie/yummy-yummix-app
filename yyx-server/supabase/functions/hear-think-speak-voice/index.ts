/**
 * HearThinkSpeak Voice Assistant Edge Function
 *
 * WebSocket-based voice assistant using modular STT→LLM→TTS pipeline:
 * - Deepgram Nova-2 for Speech-to-Text
 * - GPT-4o-mini for LLM inference
 * - Cartesia Daniela for Text-to-Speech
 *
 * Cost: ~$0.00441/min (81% cheaper than OpenAI Realtime)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { DeepgramSTTProvider } from "../_shared/providers/DeepgramSTTProvider.ts";
import { OpenAILLMProvider } from "../_shared/providers/OpenAILLMProvider.ts";
import { CartesiaTTSProvider } from "../_shared/providers/CartesiaTTSProvider.ts";

// Cartesia voice IDs (UUIDs) for different languages
const CARTESIA_VOICES = {
  en: "71a7ad14-091c-4e8e-a314-022ece01c121", // British Reading Lady - warm female
  es: "2695b6b5-5543-4be1-96d9-3967fb5e7fec", // Young Spanish-speaking Woman
} as const;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check quota
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: usage } = await supabase
      .from("ai_voice_usage")
      .select("minutes_used")
      .eq("user_id", user.id)
      .eq("month", currentMonth)
      .single();

    const QUOTA_LIMIT = 30; // 30 minutes per month
    const minutesUsed = usage?.minutes_used || 0;

    if (minutesUsed >= QUOTA_LIMIT) {
      return new Response(JSON.stringify({ error: "Monthly quota exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Create session record
    const { data: session, error: sessionError } = await supabase
      .from("ai_voice_sessions")
      .insert({
        user_id: user.id,
        status: "active",
        provider_type: "hear-think-speak",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (sessionError || !session) {
      throw new Error("Failed to create session");
    }

    console.log(`[HTS] Session created: ${session.id}`);

    // 4. Upgrade to WebSocket
    const { socket, response } = Deno.upgradeWebSocket(req);

    // Get configuration from query params
    const url = new URL(req.url);
    const language = (url.searchParams.get("language") || "en") as "en" | "es";
    const systemPrompt = url.searchParams.get("systemPrompt") ||
      "You are a helpful voice assistant.";

    // Initialize providers
    const sttProvider = new DeepgramSTTProvider();
    const llmProvider = new OpenAILLMProvider();
    const ttsProvider = new CartesiaTTSProvider();

    // Conversation state
    let conversationHistory: Array<
      { role: "user" | "assistant"; content: string }
    > = [];
    let currentTranscript = "";
    let llmTokensInput = 0;
    let llmTokensOutput = 0;
    let ttsCharacterCount = 0;
    let isProcessing = false; // Prevent concurrent processing

    socket.onopen = async () => {
      console.log("[HTS] WebSocket connected");

      try {
        // Connect to STT provider with Deepgram's default streaming sample rate
        await sttProvider.connect({
          language,
          sampleRate: 24000, // Deepgram's default streaming sample rate
          encoding: "linear16",
          utteranceEndMs: 1000, // 1 second of silence = utterance end
        });

        console.log("[HTS] STT provider connected");

        // Handle transcript events
        sttProvider.onTranscript((text, isFinal) => {
          if (isFinal) {
            currentTranscript = text;
            console.log("[HTS] Final transcript:", text);

            // Send transcript to client
            socket.send(JSON.stringify({
              type: "transcript",
              data: { text },
            }));
          }
        });

        // Handle utterance end (user finished speaking)
        sttProvider.onUtteranceEnd(async () => {
          if (!currentTranscript || isProcessing) {
            console.log("[HTS] Skipping empty or concurrent utterance");
            return;
          }

          isProcessing = true;
          console.log("[HTS] Processing utterance:", currentTranscript);

          // Add user message to history
          conversationHistory.push({
            role: "user",
            content: currentTranscript,
          });

          const userMessage = currentTranscript;
          currentTranscript = ""; // Clear for next turn

          try {
            // Stream LLM response with sentence-level TTS
            const { inputTokens, outputTokens } = await llmProvider
              .streamResponse(
                systemPrompt,
                conversationHistory,
                async (sentence) => {
                  console.log("[HTS] Sentence complete:", sentence);

                  try {
                    // Generate TTS for this sentence immediately
                    const voiceId = CARTESIA_VOICES[language] ||
                      CARTESIA_VOICES.en;
                    const audio = await ttsProvider.synthesize(
                      sentence,
                      voiceId,
                      language,
                    );
                    ttsCharacterCount += sentence.length;

                    // Convert to base64 and send to client
                    const base64Audio = btoa(String.fromCharCode(...audio));
                    socket.send(JSON.stringify({
                      type: "audio",
                      data: { audio: base64Audio },
                    }));
                  } catch (error) {
                    const errorMsg = error instanceof Error
                      ? error.message
                      : String(error);
                    console.error("[HTS] TTS error:", errorMsg);
                    socket.send(JSON.stringify({
                      type: "error",
                      data: { message: `Text-to-speech failed: ${errorMsg}` },
                    }));
                  }
                },
                (fullResponse) => {
                  console.log("[HTS] Full response complete:", fullResponse);

                  // Add assistant message to history
                  conversationHistory.push({
                    role: "assistant",
                    content: fullResponse,
                  });
                },
              );

            llmTokensInput += inputTokens;
            llmTokensOutput += outputTokens;

            console.log(
              `[HTS] Turn complete - Tokens: ${inputTokens} in, ${outputTokens} out`,
            );
          } catch (error) {
            console.error("[HTS] Error processing utterance:", error);
            socket.send(JSON.stringify({
              type: "error",
              data: { message: error.message || "Processing failed" },
            }));
          } finally {
            isProcessing = false;
          }
        });

        // Send ready status
        socket.send(JSON.stringify({
          type: "status",
          data: { status: "ready", sessionId: session.id },
        }));
      } catch (error) {
        console.error("[HTS] Setup error:", error);
        socket.send(JSON.stringify({
          type: "error",
          data: { message: error.message || "Setup failed" },
        }));
        socket.close();
      }
    };

    socket.onmessage = async (event) => {
      if (typeof event.data === "string") {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "stop") {
            console.log("[HTS] Stop requested");
            await cleanupSession();
            socket.close();
          } else if (message.type === "updateContext") {
            // Context update would need to be handled by recreating the system prompt
            // For now, we'll just log it
            console.log("[HTS] Context update received (not yet implemented)");
          } else if (message.type === "audio" && message.data) {
            // Audio sent as base64 JSON (more reliable than binary through Supabase)
            const binaryString = atob(message.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            sttProvider.sendAudio(bytes);
          }
        } catch (error) {
          console.error("[HTS] Failed to parse message:", error);
        }
      } else {
        // Binary audio data from client (fallback)
        const audioData = event.data;
        let audioBuffer: Uint8Array;

        if (audioData instanceof ArrayBuffer) {
          audioBuffer = new Uint8Array(audioData);
        } else if (audioData instanceof Blob) {
          // Handle Blob data (convert to ArrayBuffer)
          const arrayBuffer = await audioData.arrayBuffer();
          audioBuffer = new Uint8Array(arrayBuffer);
        } else {
          console.warn(
            "[HTS] Unexpected data type:",
            typeof audioData,
            audioData?.constructor?.name,
          );
          return;
        }

        sttProvider.sendAudio(audioBuffer);
      }
    };

    socket.onclose = async () => {
      console.log("[HTS] WebSocket closed");
      await cleanupSession();
    };

    socket.onerror = (error) => {
      console.error("[HTS] WebSocket error:", error);
    };

    // Cleanup function
    async function cleanupSession() {
      try {
        // Calculate costs
        const sttCost = sttProvider.getCost();
        const llmCost = (llmTokensInput * 0.15 / 1_000_000) +
          (llmTokensOutput * 0.60 / 1_000_000);
        const ttsCost = ttsProvider.getCost(ttsCharacterCount);
        const totalCost = sttCost + llmCost + ttsCost;
        const durationSeconds = sttProvider.getDurationSeconds();

        console.log(
          `[HTS] Session complete:\n` +
            `  Duration: ${durationSeconds.toFixed(2)}s\n` +
            `  STT cost: $${sttCost.toFixed(6)}\n` +
            `  LLM cost: $${
              llmCost.toFixed(6)
            } (${llmTokensInput} in, ${llmTokensOutput} out)\n` +
            `  TTS cost: $${
              ttsCost.toFixed(6)
            } (${ttsCharacterCount} chars)\n` +
            `  Total: $${totalCost.toFixed(6)}`,
        );

        // Update session in database
        const { error: updateError } = await supabase
          .from("ai_voice_sessions")
          .update({
            status: "completed",
            duration_seconds: durationSeconds,
            cost_usd: totalCost,
            stt_cost_usd: sttCost,
            llm_cost_usd: llmCost,
            tts_cost_usd: ttsCost,
            llm_tokens_input: llmTokensInput,
            llm_tokens_output: llmTokensOutput,
            tts_characters: ttsCharacterCount,
            completed_at: new Date().toISOString(),
          })
          .eq("id", session.id);

        if (updateError) {
          console.error("[HTS] Failed to update session:", updateError);
        }

        // Disconnect providers
        await sttProvider.disconnect();
      } catch (error) {
        console.error("[HTS] Cleanup error:", error);
      }
    }

    return response;
  } catch (error) {
    console.error("[HTS] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
