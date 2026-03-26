/**
 * Semantic Recipe Search Edge Function
 *
 * Lightweight endpoint for the Explore tab to run semantic (vector) search
 * when the primary lexical search returns insufficient results.
 * Wraps searchRecipesHybrid with minimal overhead.
 */

import {
  createServiceClient,
  createUserClient,
} from "../_shared/supabase-client.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { unauthorizedResponse, validateAuth } from "../_shared/auth.ts";
import { searchRecipesHybrid } from "../_shared/rag/hybrid-search.ts";
import { buildLocaleChain } from "../_shared/locale-utils.ts";
import {
  BudgetCheckUnavailableError,
  checkTextBudget,
} from "../_shared/ai-budget/index.ts";

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

    // Budget gate — reject if user has exceeded their AI budget.
    // Embedding costs are negligible (~$0.00001/query) but this prevents
    // an unmetered endpoint from being abused.
    try {
      const budget = await checkTextBudget(user.id);
      if (!budget.allowed) {
        return new Response(
          JSON.stringify({ error: "Budget exceeded" }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    } catch (err) {
      // If budget check is unavailable, allow the request (fail-open for search)
      if (!(err instanceof BudgetCheckUnavailableError)) throw err;
      console.warn(
        "[semantic-recipe-search] Budget check unavailable, allowing request",
      );
    }

    const authHeader = req.headers.get("Authorization")!;
    const supabase = createUserClient(authHeader);
    const semanticSupabase = createServiceClient();

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
