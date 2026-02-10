/**
 * Irmixy Voice Orchestrator Edge Function
 *
 * Single endpoint for voice flows:
 * - start_session: quota check + OpenAI ephemeral token + session record
 * - execute_tool: secure backend execution of whitelisted voice tools
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { unauthorizedResponse, validateAuth } from "../_shared/auth.ts";
import { createContextBuilder } from "../_shared/context-builder.ts";
import { executeTool } from "../_shared/tools/execute-tool.ts";
import { ToolValidationError } from "../_shared/tools/tool-validators.ts";
import { shapeToolResponse } from "../_shared/tools/shape-tool-response.ts";
import { getAllowedVoiceToolNames } from "../_shared/tools/tool-registry.ts";

const ALLOWED_VOICE_TOOLS = new Set(getAllowedVoiceToolNames());
const ALLOWED_ACTIONS = new Set(["start_session", "execute_tool"] as const);
const MAX_PAYLOAD_BYTES = 10_000; // 10KB
const QUOTA_LIMIT_MINUTES = 30;

interface RequestPayload {
  action?: unknown;
  toolName?: unknown;
  toolArgs?: unknown;
  sessionId?: unknown;
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

function normalizeSupabaseUrl(url: string): string {
  return url.includes("kong:8000") ? "http://host.docker.internal:54321" : url;
}

function createAnonClient(authHeader: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase configuration");
  }

  return createClient(normalizeSupabaseUrl(supabaseUrl), supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

function createServiceRoleClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration");
  }

  return createClient(normalizeSupabaseUrl(supabaseUrl), serviceRoleKey);
}

async function handleStartSession(
  userId: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const supabase = createServiceRoleClient();
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  const { data: usage } = await supabase
    .from("ai_voice_usage")
    .select("minutes_used, conversations_count")
    .eq("user_id", userId)
    .eq("month", currentMonth)
    .single();

  const minutesUsed = Number(usage?.minutes_used || 0);
  const remainingMinutes = QUOTA_LIMIT_MINUTES - minutesUsed;

  if (minutesUsed >= QUOTA_LIMIT_MINUTES) {
    return jsonResponse(
      {
        error: "Monthly quota exceeded",
        minutesUsed,
        quotaLimit: QUOTA_LIMIT_MINUTES,
        remainingMinutes: 0,
      },
      429,
      corsHeaders,
    );
  }

  const warningThreshold = QUOTA_LIMIT_MINUTES * 0.8;
  const warning = minutesUsed >= warningThreshold
    ? `You've used ${
      minutesUsed.toFixed(1)
    } of ${QUOTA_LIMIT_MINUTES} minutes this month.`
    : null;

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
        voice: "alloy",
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

  const { data: session, error: sessionError } = await supabase
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
      remainingMinutes: remainingMinutes.toFixed(1),
      warning,
      quotaLimit: QUOTA_LIMIT_MINUTES,
      minutesUsed: minutesUsed.toFixed(1),
    },
    200,
    corsHeaders,
  );
}

async function handleExecuteTool(
  payload: RequestPayload,
  userId: string,
  authHeader: string,
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

  const supabase = createAnonClient(authHeader);
  const contextBuilder = createContextBuilder(supabase);
  const userContext = await contextBuilder.buildContext(userId, sessionId);

  const argsString = typeof toolArgs === "string"
    ? toolArgs
    : JSON.stringify(toolArgs);

  const result = await executeTool(
    supabase,
    toolName,
    argsString,
    userContext,
  );

  const elapsed = Math.round(performance.now() - startTime);
  console.log(
    `[irmixy-voice-orchestrator] ${toolName} completed in ${elapsed}ms`,
  );

  const response = shapeToolResponse(toolName, result);
  return jsonResponse(response, 200, corsHeaders);
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

    if (new TextEncoder().encode(rawBody).byteLength > MAX_PAYLOAD_BYTES) {
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

    if (!ALLOWED_ACTIONS.has(action as "start_session" | "execute_tool")) {
      return jsonResponse(
        { error: `Unknown action: ${action}` },
        400,
        corsHeaders,
      );
    }

    if (action === "start_session") {
      return await handleStartSession(user.id, corsHeaders);
    }

    return await handleExecuteTool(
      payload,
      user.id,
      authHeader!,
      startTime,
      corsHeaders,
    );
  } catch (error) {
    const elapsed = Math.round(performance.now() - startTime);
    const message = error instanceof Error ? error.message : String(error);

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
