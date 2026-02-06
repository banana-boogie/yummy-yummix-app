/**
 * Voice Tool Execute Edge Function
 *
 * Executes AI tool calls on behalf of the voice client.
 * Voice uses OpenAI Realtime API via WebRTC — tool calls arrive on the
 * frontend data channel but need backend execution (DB queries, API keys).
 *
 * Flow: Frontend receives tool_call from OpenAI → POST here → result returned
 *       → frontend sends result back to OpenAI via data channel.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { validateAuth, unauthorizedResponse } from "../_shared/auth.ts";
import { createContextBuilder } from "../_shared/context-builder.ts";
import { executeTool } from "../_shared/tools/execute-tool.ts";
import { ToolValidationError } from "../_shared/tools/tool-validators.ts";
import { shapeToolResponse } from "../_shared/tools/shape-tool-response.ts";

const ALLOWED_TOOLS = ["search_recipes", "generate_custom_recipe"] as const;
const MAX_PAYLOAD_BYTES = 10_000; // 10KB limit

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json", "Allow": "POST, OPTIONS" } },
    );
  }

  const startTime = performance.now();

  try {
    // 1. Authenticate
    const authHeader = req.headers.get("Authorization");
    const { user, error: authError } = await validateAuth(authHeader);

    if (!user) {
      return unauthorizedResponse(authError || "Unauthorized", corsHeaders);
    }

    // 2. Read and validate payload size using actual body bytes
    let rawBody: string;
    try {
      rawBody = await req.text();
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to read request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (new TextEncoder().encode(rawBody).byteLength > MAX_PAYLOAD_BYTES) {
      return new Response(
        JSON.stringify({ error: "Payload too large" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Parse request JSON
    let toolName: string | undefined;
    let toolArgs: unknown;
    let sessionId: string | undefined;
    try {
      const parsed = JSON.parse(rawBody);
      toolName = parsed.toolName;
      toolArgs = parsed.toolArgs;
      if (typeof parsed.sessionId === "string" && parsed.sessionId) {
        sessionId = parsed.sessionId;
      }
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!toolName || typeof toolName !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid toolName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!ALLOWED_TOOLS.includes(toolName as typeof ALLOWED_TOOLS[number])) {
      return new Response(
        JSON.stringify({ error: `Unknown tool: ${toolName}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (toolArgs === undefined || toolArgs === null) {
      return new Response(
        JSON.stringify({ error: "Missing toolArgs" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[voice-tool-execute] User ${user.id.slice(0, 8)} calling ${toolName}`);

    // 3. Build user context
    let supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fix for local development
    if (supabaseUrl.includes("kong:8000")) {
      supabaseUrl = "http://host.docker.internal:54321";
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader! } },
    });

    const contextBuilder = createContextBuilder(supabase);
    const userContext = await contextBuilder.buildContext(user.id, sessionId);

    // 4. Execute the tool
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY") || "";
    const argsString = typeof toolArgs === "string"
      ? toolArgs
      : JSON.stringify(toolArgs);

    const result = await executeTool(
      supabase,
      toolName,
      argsString,
      userContext,
      openaiApiKey,
    );

    const elapsed = Math.round(performance.now() - startTime);
    console.log(`[voice-tool-execute] ${toolName} completed in ${elapsed}ms`);

    // 5. Shape response based on tool type
    const response = shapeToolResponse(toolName, result);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const elapsed = Math.round(performance.now() - startTime);
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof ToolValidationError) {
      console.warn(`[voice-tool-execute] Validation error (${elapsed}ms):`, message);
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.error(`[voice-tool-execute] Error (${elapsed}ms):`, message);
    return new Response(
      JSON.stringify({ error: "Tool execution failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
