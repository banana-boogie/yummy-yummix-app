/**
 * Irmixy Voice Orchestrator Edge Function
 *
 * Single endpoint for voice flows:
 * - start_session: quota check + OpenAI ephemeral token + session record
 * - execute_tool: secure backend execution of whitelisted voice tools
 *
 * NOTE: This function uses the OpenAI Realtime API directly (not the AI Gateway).
 * The Realtime API uses WebRTC for bidirectional audio streaming, which is a
 * fundamentally different protocol from chat completions. The gateway's chat()
 * interface does not apply here — this endpoint only fetches an ephemeral token
 * for the client-side WebRTC connection.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { unauthorizedResponse, validateAuth } from "../_shared/auth.ts";
import {
  createServiceClient,
  createUserClient,
} from "../_shared/supabase-client.ts";
import { createContextBuilder } from "../_shared/context-builder.ts";
import { executeTool } from "../_shared/tools/execute-tool.ts";
import { ToolValidationError } from "../_shared/tools/tool-validators.ts";
import { shapeToolResponse } from "../_shared/tools/shape-tool-response.ts";
import { getAllowedVoiceToolNames } from "../_shared/tools/tool-registry.ts";
import { buildVoiceInstructions } from "../_shared/system-prompt-builder.ts";
import type { AIUsageLogContext } from "../_shared/tools/generate-custom-recipe.ts";
import {
  BudgetCheckUnavailableError,
  checkVoiceBudget,
} from "../_shared/ai-budget/index.ts";
import type { CostContext } from "../_shared/ai-gateway/types.ts";

const ALLOWED_VOICE_TOOLS = new Set(getAllowedVoiceToolNames());
const ALLOWED_ACTIONS = new Set(
  [
    "start_session",
    "execute_tool",
    "check_quota",
    "save_transcript",
  ] as const,
);
const MAX_PAYLOAD_BYTES = 10_000; // 10KB
const MAX_TRANSCRIPT_PAYLOAD_BYTES = 100_000; // 100KB for save_transcript

interface RequestPayload {
  action?: unknown;
  toolName?: unknown;
  toolArgs?: unknown;
  sessionId?: unknown;
  messages?: unknown;
}

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": Deno.env.get("CORS_ORIGIN") || "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Read-only quota check — no session created, no ephemeral token generated.
 */
async function handleCheckQuota(
  userId: string,
  _authHeader: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const voiceBudget = await checkVoiceBudget(userId);

  return jsonResponse(
    {
      minutesUsed: voiceBudget.usedMinutes.toFixed(1),
      quotaLimit: voiceBudget.limitMinutes,
      remainingMinutes: voiceBudget.remainingMinutes.toFixed(1),
    },
    200,
    corsHeaders,
  );
}

async function handleStartSession(
  userId: string,
  authHeader: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const userClient = createUserClient(authHeader);

  // Tiered voice budget check
  const voiceBudget = await checkVoiceBudget(userId);

  if (!voiceBudget.allowed) {
    return jsonResponse(
      {
        error: "Monthly quota exceeded",
        minutesUsed: voiceBudget.usedMinutes,
        quotaLimit: voiceBudget.limitMinutes,
        remainingMinutes: 0,
      },
      429,
      corsHeaders,
    );
  }

  const remainingMinutes = voiceBudget.remainingMinutes;
  const warning = voiceBudget.warning || null;

  // Fetch user context for personalized voice instructions
  const contextBuilder = createContextBuilder(userClient);
  const userContext = await contextBuilder.buildContext(userId);
  const voiceInstructions = buildVoiceInstructions(userContext);

  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) {
    console.error("[irmixy-voice-orchestrator] OPENAI_API_KEY is missing");
    return jsonResponse(
      { error: "Server misconfiguration" },
      500,
      corsHeaders,
    );
  }

  const tokenResponse = await fetch(
    "https://api.openai.com/v1/realtime/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-realtime-mini",
        instructions: voiceInstructions,
      }),
    },
  );

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("[irmixy-voice-orchestrator] OpenAI token error:", errorText);
    return jsonResponse(
      {
        error: "Failed to generate AI token",
        details: errorText,
      },
      502,
      corsHeaders,
    );
  }

  const tokenData = await tokenResponse.json();
  const ephemeralToken = tokenData?.client_secret?.value;

  if (!ephemeralToken || typeof ephemeralToken !== "string") {
    console.error(
      "[irmixy-voice-orchestrator] Missing client_secret in OpenAI response",
    );
    return jsonResponse(
      { error: "Failed to generate AI token" },
      502,
      corsHeaders,
    );
  }

  // Service client for INSERT — no user INSERT policy on ai_voice_sessions
  const serviceClient = createServiceClient();
  const { data: session, error: sessionError } = await serviceClient
    .from("ai_voice_sessions")
    .insert({
      user_id: userId,
      status: "active",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (sessionError || !session) {
    console.error(
      "[irmixy-voice-orchestrator] Failed creating voice session:",
      sessionError?.message || "Unknown error",
    );
    return jsonResponse(
      { error: "Failed to create voice session" },
      500,
      corsHeaders,
    );
  }

  return jsonResponse(
    {
      sessionId: session.id,
      ephemeralToken,
      voiceInstructions,
      remainingMinutes: remainingMinutes.toFixed(1),
      warning,
      quotaLimit: voiceBudget.limitMinutes,
      minutesUsed: voiceBudget.usedMinutes.toFixed(1),
    },
    200,
    corsHeaders,
  );
}

async function handleExecuteTool(
  payload: RequestPayload,
  userId: string,
  authHeader: string,
  requestId: string,
  startTime: number,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const toolName = payload.toolName;
  const toolArgs = payload.toolArgs;
  const sessionId = typeof payload.sessionId === "string" && payload.sessionId
    ? payload.sessionId
    : undefined;

  if (!toolName || typeof toolName !== "string") {
    return jsonResponse(
      { error: "Missing or invalid toolName" },
      400,
      corsHeaders,
    );
  }

  if (!ALLOWED_VOICE_TOOLS.has(toolName)) {
    return jsonResponse(
      { error: `Unknown tool: ${toolName}` },
      400,
      corsHeaders,
    );
  }

  if (toolArgs === undefined || toolArgs === null) {
    return jsonResponse(
      { error: "Missing toolArgs" },
      400,
      corsHeaders,
    );
  }

  console.log(
    `[irmixy-voice-orchestrator] User ${
      userId.slice(0, 8)
    } calling ${toolName}`,
  );

  const supabase = createUserClient(authHeader);
  const contextBuilder = createContextBuilder(supabase);
  const userContext = await contextBuilder.buildContext(userId, sessionId);

  const argsString = typeof toolArgs === "string"
    ? toolArgs
    : JSON.stringify(toolArgs);

  const costContext: CostContext = {
    userId,
    edgeFunction: "irmixy-voice-orchestrator",
    metadata: {
      action: "execute_tool",
      toolName,
      ...(sessionId ? { sessionId } : {}),
    },
  };

  const usageContext: AIUsageLogContext = {
    userId,
    sessionId,
    requestId,
    functionName: "irmixy-voice-orchestrator",
  };

  const result = await executeTool(
    supabase,
    toolName,
    argsString,
    userContext,
    {
      costContext,
      usageContext,
    },
  );

  const elapsed = Math.round(performance.now() - startTime);
  console.log(
    `[irmixy-voice-orchestrator] ${toolName} completed in ${elapsed}ms`,
  );

  const response = shapeToolResponse(toolName, result);
  return jsonResponse(response, 200, corsHeaders);
}

interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
  recipes?: unknown;
  customRecipe?: unknown;
  safetyFlags?: unknown;
}

async function handleSaveTranscript(
  payload: RequestPayload,
  userId: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const messages = payload.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse(
      { error: "Missing or empty messages array" },
      400,
      corsHeaders,
    );
  }

  // Validate each message
  for (const msg of messages) {
    if (
      !msg || typeof msg !== "object" ||
      !("role" in msg) || !("content" in msg) ||
      typeof msg.content !== "string" ||
      (msg.role !== "user" && msg.role !== "assistant")
    ) {
      return jsonResponse(
        {
          error: "Invalid message format: each message needs role and content",
        },
        400,
        corsHeaders,
      );
    }
  }

  const validMessages = messages as TranscriptMessage[];

  // Generate title from first user message (truncated to 100 chars)
  const firstUserMsg = validMessages.find((m) => m.role === "user");
  const title = firstUserMsg
    ? firstUserMsg.content.slice(0, 100).trim() || "Voice conversation"
    : "Voice conversation";

  const serviceClient = createServiceClient();

  // Create chat session with source = 'voice'
  const { data: session, error: sessionError } = await serviceClient
    .from("ai_chat_sessions")
    .insert({
      user_id: userId,
      title,
      source: "voice",
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    console.error(
      "[irmixy-voice-orchestrator] Failed creating chat session:",
      sessionError?.message,
    );
    return jsonResponse(
      { error: "Failed to save transcript" },
      500,
      corsHeaders,
    );
  }

  // Bulk insert messages
  const messagesToInsert = validMessages.map((msg, idx) => ({
    session_id: session.id,
    role: msg.role,
    content: msg.content,
    // Store recipe data in tool_calls JSONB (same format as text chat)
    tool_calls: (msg.recipes || msg.customRecipe || msg.safetyFlags)
      ? {
        ...(msg.recipes ? { recipes: msg.recipes } : {}),
        ...(msg.customRecipe ? { customRecipe: msg.customRecipe } : {}),
        ...(msg.safetyFlags ? { safetyFlags: msg.safetyFlags } : {}),
      }
      : null,
    created_at: new Date(Date.now() + idx).toISOString(), // offset by idx to preserve order
  }));

  const { error: insertError } = await serviceClient
    .from("user_chat_messages")
    .insert(messagesToInsert);

  if (insertError) {
    console.error(
      "[irmixy-voice-orchestrator] Failed inserting messages:",
      insertError.message,
    );
    // Clean up orphaned session
    await serviceClient
      .from("ai_chat_sessions")
      .delete()
      .eq("id", session.id);
    return jsonResponse(
      { error: "Failed to save transcript messages" },
      500,
      corsHeaders,
    );
  }

  console.log(
    `[irmixy-voice-orchestrator] Saved ${validMessages.length} voice messages to session ${session.id}`,
  );

  return jsonResponse(
    { sessionId: session.id, saved: validMessages.length },
    200,
    corsHeaders,
  );
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed" },
      405,
      corsHeaders,
      { Allow: "POST, OPTIONS" },
    );
  }

  const startTime = performance.now();
  const requestId = crypto.randomUUID();

  try {
    const authHeader = req.headers.get("Authorization");
    const { user, error: authError } = await validateAuth(authHeader);

    if (!user) {
      return unauthorizedResponse(authError || "Unauthorized", corsHeaders);
    }

    let rawBody = "";
    try {
      rawBody = await req.text();
    } catch {
      return jsonResponse(
        { error: "Failed to read request body" },
        400,
        corsHeaders,
      );
    }

    // Hard universal limit (save_transcript may be up to 100KB)
    const bodyByteLength = new TextEncoder().encode(rawBody).byteLength;
    if (bodyByteLength > MAX_TRANSCRIPT_PAYLOAD_BYTES) {
      return jsonResponse(
        { error: "Payload too large" },
        413,
        corsHeaders,
      );
    }

    let payload: RequestPayload;
    try {
      payload = (rawBody ? JSON.parse(rawBody) : {}) as RequestPayload;
    } catch {
      return jsonResponse(
        { error: "Invalid JSON in request body" },
        400,
        corsHeaders,
      );
    }

    // Action-specific limit: non-save_transcript actions get the smaller 10KB limit
    if (
      payload.action !== "save_transcript" && bodyByteLength > MAX_PAYLOAD_BYTES
    ) {
      return jsonResponse(
        { error: "Payload too large" },
        413,
        corsHeaders,
      );
    }

    if (!payload || typeof payload !== "object") {
      return jsonResponse(
        { error: "Invalid request body" },
        400,
        corsHeaders,
      );
    }

    const action = payload.action;

    if (!action || typeof action !== "string") {
      return jsonResponse(
        { error: "Missing or invalid action" },
        400,
        corsHeaders,
      );
    }

    if (
      !ALLOWED_ACTIONS.has(
        action as
          | "start_session"
          | "execute_tool"
          | "check_quota"
          | "save_transcript",
      )
    ) {
      return jsonResponse(
        { error: `Unknown action: ${action}` },
        400,
        corsHeaders,
      );
    }

    if (action === "check_quota") {
      return await handleCheckQuota(user.id, authHeader!, corsHeaders);
    }

    if (action === "start_session") {
      return await handleStartSession(user.id, authHeader!, corsHeaders);
    }

    if (action === "save_transcript") {
      return await handleSaveTranscript(payload, user.id, corsHeaders);
    }

    return await handleExecuteTool(
      payload,
      user.id,
      authHeader!,
      requestId,
      startTime,
      corsHeaders,
    );
  } catch (error) {
    const elapsed = Math.round(performance.now() - startTime);
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof BudgetCheckUnavailableError) {
      console.error(
        `[irmixy-voice-orchestrator] Budget check unavailable (${elapsed}ms):`,
        message,
      );
      return jsonResponse(
        { error: "budget_unavailable" },
        503,
        corsHeaders,
      );
    }

    if (error instanceof ToolValidationError) {
      console.warn(
        `[irmixy-voice-orchestrator] Validation error (${elapsed}ms):`,
        message,
      );
      return jsonResponse({ error: message }, 400, corsHeaders);
    }

    console.error(`[irmixy-voice-orchestrator] Error (${elapsed}ms):`, message);
    return jsonResponse(
      { error: "Voice orchestration failed" },
      500,
      corsHeaders,
    );
  }
});
