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
import type { RecipeCard } from "../_shared/irmixy-schemas.ts";
import type { GenerateRecipeResult } from "../_shared/tools/generate-custom-recipe.ts";

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

    // 2. Check payload size
    const contentLength = parseInt(req.headers.get("Content-Length") || "0", 10);
    if (contentLength > MAX_PAYLOAD_BYTES) {
      return new Response(
        JSON.stringify({ error: "Payload too large" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Parse request
    const { toolName, toolArgs } = await req.json();

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
    const userContext = await contextBuilder.buildContext(user.id);

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
    let response: Record<string, unknown>;

    if (toolName === "search_recipes") {
      response = { recipes: result as RecipeCard[] };
    } else if (toolName === "generate_custom_recipe") {
      const genResult = result as GenerateRecipeResult;
      response = {
        customRecipe: genResult.recipe,
        safetyFlags: genResult.safetyFlags,
      };
    } else {
      response = { result };
    }

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
