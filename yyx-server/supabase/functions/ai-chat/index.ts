/**
 * AI Chat Edge Function
 *
 * Handles conversational AI requests with:
 * - Streaming responses
 * - User context awareness
 * - Chat history persistence
 * - Language localization
 */

// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  forbiddenResponse,
  unauthorizedResponse,
  validateAuth,
} from "../_shared/auth.ts";
import { sanitizeContent } from "../_shared/context-builder.ts";
import { AIMessage, chat } from "../_shared/ai-gateway/index.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// Types
// =============================================================================

interface ChatRequest {
  message: string;
  sessionId?: string;
  language?: "en" | "es";
}

// =============================================================================
// System Prompts (Bilingual)
// =============================================================================

const SYSTEM_PROMPTS = {
  en:
    `You are Irmixy, a friendly and knowledgeable AI chef assistant for YummyYummix, a cooking app focused on Thermomix recipes.

Your capabilities:
- Answer cooking questions
- Suggest recipe modifications and substitutions
- Help with meal planning
- Provide cooking tips and techniques

Guidelines:
- Be warm, encouraging, and helpful
- If you don't know something, say so
- Consider the user's preferences and dietary restrictions when known
- Always respond in English

Response Style:
- Keep responses concise (2-4 sentences for simple questions)
- Use bullet points for lists instead of paragraphs
- Only elaborate when the user asks for more details
- Avoid long introductions or unnecessary pleasantries

The user may ask you about recipes, ingredients, cooking techniques, or meal ideas.`,

  es:
    `Eres Irmixy, un asistente de cocina amigable y experto para YummyYummix, una aplicación de cocina enfocada en recetas de Thermomix.

Tus capacidades:
- Responder preguntas de cocina
- Sugerir modificaciones y sustituciones de recetas
- Ayudar con la planificación de comidas
- Proporcionar consejos y técnicas de cocina

Directrices:
- Sé cálido, alentador y servicial
- Si no sabes algo, dilo
- Considera las preferencias y restricciones dietéticas del usuario cuando se conozcan
- Siempre responde en español

Estilo de respuesta:
- Mantén las respuestas concisas (2-4 oraciones para preguntas simples)
- Usa viñetas para listas en lugar de párrafos
- Solo elabora cuando el usuario pida más detalles
- Evita introducciones largas o cortesías innecesarias

El usuario puede preguntar sobre recetas, ingredientes, técnicas de cocina o ideas de comidas.`,
};

// =============================================================================
// Helper Functions
// =============================================================================

class SessionForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionForbiddenError";
  }
}

function createSupabaseClient(authHeader: string): SupabaseClient {
  let supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase configuration");
  }

  // Fix for local development: kong:8000 is internal Docker address
  if (supabaseUrl.includes("kong:8000")) {
    supabaseUrl = "http://host.docker.internal:54321";
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });
}

async function assertSessionOwnership(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_chat_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to validate session ownership:", error);
    throw new Error("Failed to validate session");
  }

  return !!data;
}

async function getOrCreateSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId?: string,
): Promise<string> {
  if (sessionId) {
    const ownsSession = await assertSessionOwnership(
      supabase,
      userId,
      sessionId,
    );
    if (!ownsSession) {
      throw new SessionForbiddenError("Session not found or not owned by user");
    }
    return sessionId;
  }

  const { data: newSession, error } = await supabase
    .from("user_chat_sessions")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return newSession.id;
}

async function getChatHistory(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<AIMessage[]> {
  const { data: history } = await supabase
    .from("user_chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(10);

  return (history || []).map((m: any) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));
}

async function saveUserMessage(
  supabase: SupabaseClient,
  sessionId: string,
  content: string,
): Promise<void> {
  await supabase.from("user_chat_messages").insert({
    session_id: sessionId,
    role: "user",
    content,
  });
}

async function saveAssistantMessage(
  supabase: SupabaseClient,
  sessionId: string,
  content: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  await supabase.from("user_chat_messages").insert({
    session_id: sessionId,
    role: "assistant",
    content,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  });
}

async function logChatEvent(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<void> {
  await supabase.from("user_events").insert({
    user_id: userId,
    event_type: "chat_message",
    payload: { session_id: sessionId },
  });
}

function validateRequest(message: string): { valid: boolean; error?: string } {
  if (!message || message.trim().length === 0) {
    return { valid: false, error: "Message is required" };
  }

  // Max 2000 characters is reasonable for chat messages
  if (message.length > 2000) {
    return { valid: false, error: "Message too long (max 2000 characters)" };
  }

  return { valid: true };
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  console.info(`[${requestId}] AI Chat request received`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // Validate authentication
  const authHeader = req.headers.get("Authorization");
  const { user, error: authError } = await validateAuth(authHeader);

  if (authError || !user) {
    console.warn(`[${requestId}] Auth failed: ${authError}`);
    return unauthorizedResponse(
      authError ?? "Authentication required",
      corsHeaders,
    );
  }

  console.info(`[${requestId}] Authenticated user: ${user.id}`);

  try {
    const { message, sessionId, language = "en", stream = false } = await req
      .json() as ChatRequest & { stream?: boolean };

    // Validate input
    const validation = validateRequest(message);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const sanitizedMessage = sanitizeContent(message);

    const supabase = createSupabaseClient(authHeader!);

    // Get or create chat session
    let currentSessionId: string;
    try {
      currentSessionId = await getOrCreateSession(supabase, user.id, sessionId);
    } catch (error) {
      if (error instanceof SessionForbiddenError) {
        return forbiddenResponse("Session not found", corsHeaders);
      }
      throw error;
    }

    // Get chat history
    const history = await getChatHistory(supabase, currentSessionId);
    const sanitizedHistory = history.map((entry) => ({
      ...entry,
      content: sanitizeContent(entry.content),
    }));

    // Build messages array with localized system prompt
    const systemPrompt = SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.en;
    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      ...sanitizedHistory,
      { role: "user", content: sanitizedMessage },
    ];

    // Save user message
    await saveUserMessage(supabase, currentSessionId, message);

    // Log event for learning
    await logChatEvent(supabase, user.id, currentSessionId);

    // STREAMING MODE
    if (stream) {
      console.info(`[${requestId}] Starting SSE stream`);

      const encoder = new TextEncoder();
      let fullContent = "";

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Send session ID first
            console.info(
              `[${requestId}] Sending session ID: ${currentSessionId}`,
            );
            controller.enqueue(
              encoder.encode(
                `data: ${
                  JSON.stringify({
                    type: "session",
                    sessionId: currentSessionId,
                  })
                }\n\n`,
              ),
            );

            // Stream content chunks
            console.info(`[${requestId}] Importing chatStream...`);
            const { chatStream } = await import(
              "../_shared/ai-gateway/index.ts"
            );
            console.info(`[${requestId}] Starting to stream from OpenAI...`);

            let chunkCount = 0;
            for await (
              const chunk of chatStream({
                usageType: "text",
                messages,
                temperature: 0.7,
                maxTokens: 1024,
              })
            ) {
              chunkCount++;
              fullContent += chunk;
              controller.enqueue(
                encoder.encode(
                  `data: ${
                    JSON.stringify({ type: "content", content: chunk })
                  }\n\n`,
                ),
              );
            }

            console.info(
              `[${requestId}] Stream complete, ${chunkCount} chunks, ${fullContent.length} chars`,
            );

            // Send done event
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
            );
            controller.close();

            // Save assistant message after streaming completes
            await saveAssistantMessage(
              supabase,
              currentSessionId,
              fullContent,
              0,
              0,
            );
            console.info(`[${requestId}] Message saved`);
          } catch (error) {
            console.error(`[${requestId}] Stream error:`, error);
            console.error(`[${requestId}] Stack:`, error.stack);
            controller.enqueue(
              encoder.encode(
                `data: ${
                  JSON.stringify({ type: "error", error: error.message })
                }\n\n`,
              ),
            );
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...corsHeaders,
        },
      });
    }

    // NON-STREAMING MODE (default)
    const aiResponse = await chat({
      usageType: "text",
      messages,
      temperature: 0.7,
      maxTokens: 1024,
    });

    // Save assistant response
    await saveAssistantMessage(
      supabase,
      currentSessionId,
      aiResponse.content,
      aiResponse.usage.inputTokens,
      aiResponse.usage.outputTokens,
    );

    return new Response(
      JSON.stringify({
        content: aiResponse.content,
        sessionId: currentSessionId,
        usage: aiResponse.usage,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});
