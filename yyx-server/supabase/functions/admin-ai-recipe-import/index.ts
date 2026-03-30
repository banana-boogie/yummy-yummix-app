/**
 * Admin AI Recipe Import
 *
 * Accepts recipe text in any format (markdown, plain text, HTML, copy-paste)
 * and any language. Uses AI to parse into structured JSON with translations
 * for en, es (Mexican Spanish), and es-ES (Spain Spanish).
 */

// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { chat } from "../_shared/ai-gateway/index.ts";
import {
  forbiddenResponse,
  unauthorizedResponse,
  validateAuth,
} from "../_shared/auth.ts";

// =============================================================================
// System Prompt
// =============================================================================

const systemPrompt =
  `You are a recipe parser for a cooking app. You convert recipe text into structured JSON.

INPUT: Recipe text in any format (markdown, plain text, HTML, copy-paste from websites) and any language.

OUTPUT: Structured recipe JSON with translations for exactly 3 locales:
- "en" — English
- "es" — Mexican Spanish (use Mexican vocabulary: jitomate, elote, chícharo, ejote, cacahuates)
- "es-ES" — Spain Spanish (use Spain vocabulary: tomate, maíz, guisantes, judías verdes, cacahuetes)

LANGUAGE HANDLING:
- Auto-detect the input language.
- Translate all text fields into all 3 locales. The input language gives you the source — translate the other two.
- For es vs es-ES: adapt regional vocabulary, not just copy. "Jitomate" (es) → "Tomate" (es-ES). "Cacahuates" (es) → "Cacahuetes" (es-ES).

THERMOMIX PARAMETERS:
- Extract from patterns like "(40 sec/reverse blades/speed 3)", "(10 min/90°C/speed 2)", "Varoma/speed 1/15 min".
- thermomixTime: always in seconds (convert minutes to seconds).
- thermomixMode: detect cooking modes — slow_cook, rice_cooker, sous_vide, fermentation, open_cooking, browning (TM7 only), steaming, dough, turbo. null if no mode.
- thermomixIsBladeReversed: true if "reverse", "giro inverso", "sentido inverso" mentioned.

TIMER EXTRACTION:
- For non-Thermomix steps with explicit durations ("bake for 20 minutes", "let rest 10 min"), extract timerSeconds.
- Convert to seconds. "20 minutes" → 1200. "1 hour" → 3600.

OPTIONAL INGREDIENTS:
- Detect "optional", "opcional", "to taste", "al gusto" — set optional: true.

RECIPE SECTIONS:
- If the recipe has multiple components (e.g., "For the sauce", "For the filling"), use the section title in recipeSection.
- Default: "Main" for en, "Principal" for es/es-ES.

DESCRIPTION:
- Write a short, appetizing description (1-2 sentences) for each locale. Capture the essence of the dish.

RULES:
- DO NOT invent ingredients, steps, tools, or tags not present in the source text.
- DO NOT add Thermomix parameters unless the source text contains them.
- Quantities are numeric (use 0.5 not "1/2", use 0.25 not "1/4").
- If information is missing (e.g., no prep time given), use reasonable estimates based on the recipe.
- Tags should be lowercase, no # prefix.
`;

// =============================================================================
// JSON Schema
// =============================================================================

const speedEnum = [
  "spoon",
  0.5,
  1,
  1.5,
  2,
  2.5,
  3,
  3.5,
  4,
  4.5,
  5,
  5.5,
  6,
  6.5,
  7,
  7.5,
  8,
  8.5,
  9,
  9.5,
  10,
  null,
];

const measurementUnitEnum = [
  "clove",
  "cup",
  "g",
  "kg",
  "l",
  "lb",
  "leaf",
  "ml",
  "oz",
  "piece",
  "pinch",
  "slice",
  "sprig",
  "taste",
  "tbsp",
  "tsp",
  "unit",
];

const temperatureEnum = [
  37,
  40,
  45,
  50,
  55,
  60,
  65,
  70,
  75,
  80,
  85,
  90,
  95,
  98,
  100,
  105,
  110,
  115,
  120,
  "Varoma",
  130,
  140,
  150,
  160,
  170,
  175,
  185,
  195,
  200,
  205,
  212,
  220,
  230,
  240,
  250,
  null,
];

const thermomixModeEnum = [
  "slow_cook",
  "rice_cooker",
  "sous_vide",
  "fermentation",
  "open_cooking",
  "browning",
  "steaming",
  "dough",
  "turbo",
  null,
];

const localeTranslationItems = (fields: Record<string, unknown>[]) => ({
  type: "array",
  description: "Translations for locales: en, es (Mexico), es-ES (Spain).",
  items: {
    type: "object",
    properties: {
      locale: {
        type: "string",
        description: "Locale code: 'en', 'es', or 'es-ES'.",
      },
      ...Object.fromEntries(fields.map((f) => [f.name, f.schema])),
    },
    required: ["locale", ...fields.map((f) => f.name as string)],
    additionalProperties: false,
  },
});

const ingredientTranslationSchema = localeTranslationItems([
  {
    name: "name",
    schema: {
      type: "string",
      description: "Ingredient name only — no quantities or adjectives.",
    },
  },
  {
    name: "pluralName",
    schema: {
      type: "string",
      description: "Plural ingredient name only.",
    },
  },
]);

const jsonSchema = {
  type: "object",
  properties: {
    translations: localeTranslationItems([
      {
        name: "name",
        schema: { type: "string", description: "Recipe name." },
      },
      {
        name: "description",
        schema: {
          type: "string",
          description: "Short appetizing description (1-2 sentences).",
        },
      },
      {
        name: "tipsAndTricks",
        schema: {
          type: "string",
          description: "Tips and tricks section. Empty string if none.",
        },
      },
    ]),
    totalTime: {
      type: "number",
      description: "Total time in minutes.",
    },
    prepTime: {
      type: "number",
      description: "Preparation time in minutes.",
    },
    difficulty: {
      type: "string",
      enum: ["easy", "medium", "hard"],
    },
    portions: {
      type: "number",
      description: "Number of servings.",
    },
    kitchenTools: {
      type: "array",
      description: "Kitchen tools needed.",
      items: {
        type: "object",
        properties: {
          translations: localeTranslationItems([
            {
              name: "name",
              schema: { type: "string", description: "Tool name." },
            },
            {
              name: "notes",
              schema: {
                type: "string",
                description: "Notes about the tool. Empty string if none.",
              },
            },
          ]),
          displayOrder: { type: "number", description: "1-based order." },
        },
        required: ["translations", "displayOrder"],
        additionalProperties: false,
      },
    },
    ingredients: {
      type: "array",
      description: "Ingredients list.",
      items: {
        type: "object",
        properties: {
          ingredient: {
            type: "object",
            properties: {
              translations: ingredientTranslationSchema,
            },
            required: ["translations"],
            additionalProperties: false,
          },
          quantity: { type: "number", description: "Numeric quantity." },
          measurementUnitID: {
            type: "string",
            enum: measurementUnitEnum,
            default: "unit",
          },
          optional: {
            type: "boolean",
            description: "True if marked optional, 'al gusto', or 'to taste'.",
          },
          translations: localeTranslationItems([
            {
              name: "notes",
              schema: {
                type: "string",
                description: "Preparation notes. Empty string if none.",
              },
            },
            {
              name: "tip",
              schema: {
                type: "string",
                description: "Ingredient tip. Empty string if none.",
              },
            },
            {
              name: "recipeSection",
              schema: {
                type: "string",
                description:
                  "Section title. 'Main'/'Principal'/'Principal' for en/es/es-ES if no sections.",
              },
            },
          ]),
          displayOrder: { type: "number", description: "1-based order." },
        },
        required: [
          "quantity",
          "measurementUnitID",
          "optional",
          "ingredient",
          "translations",
          "displayOrder",
        ],
        additionalProperties: false,
      },
    },
    steps: {
      type: "array",
      description: "Cooking steps.",
      items: {
        type: "object",
        properties: {
          order: { type: "number", description: "1-based step order." },
          translations: localeTranslationItems([
            {
              name: "instruction",
              schema: { type: "string", description: "Full instruction." },
            },
            {
              name: "tip",
              schema: {
                type: "string",
                description: "Step tip. Empty string if none.",
              },
            },
            {
              name: "recipeSection",
              schema: {
                type: "string",
                description:
                  "Section title. 'Main'/'Principal'/'Principal' for en/es/es-ES if no sections.",
              },
            },
          ]),
          thermomixTime: {
            type: ["number", "null"],
            description: "Time in seconds. null if not a Thermomix step.",
          },
          thermomixTemperature: {
            type: ["number", "string", "null"],
            enum: temperatureEnum,
          },
          thermomixTemperatureUnit: {
            type: ["string", "null"],
            enum: ["C", "F", null],
            description: "Temperature unit: C or F. null if no temperature.",
          },
          thermomixSpeed: {
            type: ["object", "null"],
            properties: {
              type: { type: "string", enum: ["single", "range"] },
              value: { type: ["number", "string", "null"], enum: speedEnum },
              start: { type: ["number", "string", "null"], enum: speedEnum },
              end: { type: ["number", "string", "null"], enum: speedEnum },
            },
            required: ["type", "value", "start", "end"],
            additionalProperties: false,
          },
          thermomixIsBladeReversed: {
            type: ["boolean", "null"],
          },
          thermomixMode: {
            type: ["string", "null"],
            enum: thermomixModeEnum,
            description: "Thermomix cooking mode if applicable.",
          },
          timerSeconds: {
            type: ["number", "null"],
            description:
              "Timer for non-Thermomix steps in seconds. null if no explicit duration.",
          },
          ingredients: {
            type: "array",
            description: "Ingredients used in this step.",
            items: {
              type: "object",
              properties: {
                ingredient: {
                  type: "object",
                  properties: {
                    translations: ingredientTranslationSchema,
                  },
                  required: ["translations"],
                  additionalProperties: false,
                },
                quantity: { type: "number" },
                measurementUnitID: {
                  type: "string",
                  enum: measurementUnitEnum,
                  default: "unit",
                },
                displayOrder: { type: "number" },
              },
              required: [
                "ingredient",
                "quantity",
                "measurementUnitID",
                "displayOrder",
              ],
              additionalProperties: false,
            },
          },
        },
        required: [
          "order",
          "translations",
          "thermomixTime",
          "thermomixTemperature",
          "thermomixTemperatureUnit",
          "thermomixSpeed",
          "thermomixIsBladeReversed",
          "thermomixMode",
          "timerSeconds",
          "ingredients",
        ],
        additionalProperties: false,
      },
    },
    tags: {
      type: "array",
      description: "Recipe tags, lowercase, no # prefix.",
      items: { type: "string" },
    },
  },
  required: [
    "translations",
    "totalTime",
    "prepTime",
    "difficulty",
    "portions",
    "kitchenTools",
    "ingredients",
    "steps",
    "tags",
  ],
  additionalProperties: false,
};

// =============================================================================
// Handler
// =============================================================================

serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const startTime = performance.now();

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // Validate admin authentication
  const authHeader = req.headers.get("Authorization");
  const { user, error: authError } = await validateAuth(authHeader);

  if (authError || !user) {
    console.warn(`[${requestId}] Auth failed: ${authError}`);
    return unauthorizedResponse(
      authError ?? "Authentication required",
      corsHeaders,
    );
  }

  // Check admin status from database
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const { createClient } = await import(
    "https://esm.sh/@supabase/supabase-js@2"
  );
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader! } },
  });
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    console.warn(`[${requestId}] User ${user.id} attempted admin-only action`);
    return forbiddenResponse("Admin access required", corsHeaders);
  }

  console.info(`[${requestId}] Authenticated admin user: ${user.id}`);

  try {
    const body = await req.json();
    const content = body.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Recipe content is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    console.info(
      `[${requestId}] Received content of length: ${content.length}`,
    );

    const response = await chat({
      usageType: "parsing",
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      temperature: 1,
      maxTokens: 16000,
      responseFormat: {
        type: "json_schema",
        schema: jsonSchema,
      },
    });

    const result = response.content || null;

    if (!result) {
      console.error(`[${requestId}] Missing content from AI response`);
      return new Response(
        JSON.stringify({ error: "Failed to get a response from AI" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const processingTime = performance.now() - startTime;
    console.info(
      `[${requestId}] Processed in ${
        processingTime.toFixed(0)
      }ms | model: ${response.model} | tokens: ${response.usage.inputTokens}in/${response.usage.outputTokens}out | cost: $${
        response.costUsd.toFixed(4)
      }`,
    );

    return new Response(
      JSON.stringify(result),
      { headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    console.error(`[${requestId}] Error:`, errorMessage);
    return new Response(
      JSON.stringify({
        error: "Failed to import recipe. Check server logs for details.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});
