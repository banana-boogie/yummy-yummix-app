/**
 * Translate Content Edge Function
 *
 * Translates recipe/entity content fields between locales using the AI Gateway.
 * Called by the admin panel's auto-translate feature.
 *
 * POST /translate-content
 * Authorization: Bearer <admin-jwt>
 * Body: { fields, sourceLocale, targetLocales }
 */

import { corsHeaders } from "../_shared/cors.ts";
import { createUserClient } from "../_shared/supabase-client.ts";
import { chat } from "../_shared/ai-gateway/index.ts";
import { getLanguageName } from "../_shared/locale-utils.ts";
import {
  buildResponseSchema,
  REGIONAL_ADAPTATION_HINTS,
  type TranslationResult,
  validateRequest,
} from "./utils.ts";

// ============================================================
// Helpers
// ============================================================

function jsonResponse(
  body: unknown,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Translate fields to a single target locale.
 */
async function translateToLocale(
  fields: Record<string, string>,
  sourceLocale: string,
  targetLocale: string,
): Promise<TranslationResult> {
  const sourceLangName = getLanguageName(sourceLocale);
  const targetLangName = getLanguageName(targetLocale);
  const fieldKeys = Object.keys(fields);

  // Build regional hint if applicable
  const hintKey = `${sourceLocale}>${targetLocale}`;
  const adaptationHint = REGIONAL_ADAPTATION_HINTS[hintKey] ?? "";

  const systemPrompt = [
    `You are a professional culinary translator. Translate the following recipe content from ${sourceLangName} to ${targetLangName}.`,
    "Preserve culinary terminology appropriate for the target region.",
    adaptationHint,
    "Return ONLY the translated fields as JSON.",
  ].filter(Boolean).join(" ");

  const userMessage = JSON.stringify(fields);

  const response = await chat({
    usageType: "parsing",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    responseFormat: {
      type: "json_schema",
      schema: buildResponseSchema(fieldKeys),
    },
  });

  const parsed = JSON.parse(response.content) as Record<string, string>;

  return {
    targetLocale,
    fields: parsed,
  };
}

// ============================================================
// Main handler
// ============================================================

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization" }, 401);
    }

    const supabase = createUserClient(authHeader);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Admin check via RPC
    const { data: isAdmin, error: adminError } = await supabase.rpc(
      "is_admin",
    );
    if (adminError || !isAdmin) {
      return jsonResponse({ error: "Forbidden: admin access required" }, 403);
    }

    // Parse and validate request
    const body = await req.json();
    const request = validateRequest(body);

    // Translate to all target locales in parallel
    const results = await Promise.allSettled(
      request.targetLocales.map((targetLocale) =>
        translateToLocale(request.fields, request.sourceLocale, targetLocale)
      ),
    );

    // Shape results, capturing per-locale errors
    const translations: TranslationResult[] = results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      const errorMessage = result.reason instanceof Error
        ? result.reason.message
        : String(result.reason);
      console.error(
        `[translate-content] Failed for locale ${
          request.targetLocales[index]
        }:`,
        errorMessage,
      );
      return {
        targetLocale: request.targetLocales[index],
        fields: {},
        error: "Translation failed",
      };
    });

    return jsonResponse({ translations }, 200);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("'")) {
      // Validation error — return 400
      return jsonResponse({ error: error.message }, 400);
    }
    console.error("[translate-content] Error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
