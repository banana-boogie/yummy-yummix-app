/**
 * Semantic Recipe Search Edge Function
 *
 * Lightweight endpoint for the Explore tab to run semantic (vector) search
 * when the primary lexical search returns insufficient results.
 * Wraps searchRecipesHybrid with minimal overhead.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { unauthorizedResponse, validateAuth } from "../_shared/auth.ts";
import { searchRecipesHybrid } from "../_shared/rag/hybrid-search.ts";
import { buildLocaleChain } from "../_shared/locale-utils.ts";

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth
  const { user, error: authError } = await validateAuth(
    req.headers.get("Authorization"),
  );
  if (authError || !user) {
    return unauthorizedResponse(authError ?? "Unauthorized", corsHeaders);
  }

  try {
    const { query, locale, limit } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: "Query must be at least 2 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    // Use service client for embedding RPC if available
    const semanticSupabase = serviceKey
      ? createClient(supabaseUrl, serviceKey)
      : supabase;

    const localeChain = buildLocaleChain(locale || "en");

    const result = await searchRecipesHybrid(
      supabase,
      query.trim(),
      { limit: Math.min(limit || 10, 20) },
      {
        locale: locale || "en",
        localeChain,
        measurementSystem: "metric",
        dietaryRestrictions: [],
        cuisinePreferences: [],
      },
      semanticSupabase,
    );

    return new Response(
      JSON.stringify({
        recipes: result.recipes,
        method: result.method,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[semantic-recipe-search] Error:", err);
    return new Response(
      JSON.stringify({ error: "Search failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
