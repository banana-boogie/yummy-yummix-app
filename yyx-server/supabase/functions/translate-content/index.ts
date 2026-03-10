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

// ============================================================
// Types
// ============================================================

interface TranslateRequest {
  fields: Record<string, string>;
  sourceLocale: string;
  targetLocales: string[];
}

interface TranslationResult {
  targetLocale: string;
  fields: Record<string, string>;
  error?: string;
}

// ============================================================
// Vocabulary adaptation hints for regional Spanish variants
// ============================================================

const REGIONAL_ADAPTATION_HINTS: Record<string, string> = {
  "es>es-ES":
    "Adapt Mexican Spanish food terms to Spain Spanish (jitomate\u2192tomate, cacahuate\u2192cacahuete, elote\u2192ma\u00edz, crema\u2192nata, papa\u2192patata, jugo\u2192zumo, ch\u00edcharo\u2192guisante, ejote\u2192jud\u00eda verde).",
  "es-ES>es":
    "Adapt Spain Spanish food terms to Mexican Spanish (tomate\u2192jitomate, cacahuete\u2192cacahuate, ma\u00edz\u2192elote, nata\u2192crema, patata\u2192papa, zumo\u2192jugo, guisante\u2192ch\u00edcharo, jud\u00eda verde\u2192ejote).",
};

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

function validateRequest(body: unknown): TranslateRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }

  const { fields, sourceLocale, targetLocales } = body as Record<
    string,
    unknown
  >;

  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    throw new Error("'fields' must be a non-empty object of string values");
  }

  const fieldEntries = Object.entries(fields as Record<string, unknown>);
  if (fieldEntries.length === 0) {
    throw new Error("'fields' must contain at least one field");
  }
  for (const [key, value] of fieldEntries) {
    if (typeof value !== "string") {
      throw new Error(`Field '${key}' must be a string`);
    }
  }

  if (typeof sourceLocale !== "string" || sourceLocale.length === 0) {
    throw new Error("'sourceLocale' must be a non-empty string");
  }

  if (
    !Array.isArray(targetLocales) || targetLocales.length === 0 ||
    !targetLocales.every((l) => typeof l === "string" && l.length > 0)
  ) {
    throw new Error(
      "'targetLocales' must be a non-empty array of locale strings",
    );
  }

  return {
    fields: fields as Record<string, string>,
    sourceLocale,
    targetLocales,
  };
}

/**
 * Build the JSON schema for the AI response.
 * Matches the shape of the input fields.
 */
function buildResponseSchema(
  fieldKeys: string[],
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const key of fieldKeys) {
    properties[key] = { type: "string" };
  }
  return {
    type: "object",
    properties,
    required: fieldKeys,
    additionalProperties: false,
  };
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
