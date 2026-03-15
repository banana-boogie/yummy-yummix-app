// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { chat } from "../_shared/ai-gateway/index.ts";
import {
  forbiddenResponse,
  hasRole,
  unauthorizedResponse,
  validateAuth,
} from "../_shared/auth.ts";

const jsonSchema = {
  "name": "recipe",
  "schema": {
    "type": "object",
    "properties": {
      "translations": {
        "type": "array",
        "description":
          "Locale-keyed translations for the recipe name and tips.",
        "items": {
          "type": "object",
          "properties": {
            "locale": {
              "type": "string",
              "description": "Locale code, e.g. 'en' or 'es'.",
            },
            "name": {
              "type": "string",
              "description": "Recipe name in this locale.",
            },
            "tipsAndTricks": {
              "type": "string",
              "description": "Tips section in this locale.",
            },
          },
          "required": ["locale", "name", "tipsAndTricks"],
          "additionalProperties": false,
        },
      },
      "totalTime": {
        "type": "number",
        "description": "Total time required to make the recipe.",
      },
      "prepTime": {
        "type": "number",
        "description": "Preparation time needed before cooking.",
      },
      "difficulty": {
        "type": "string",
        "description": "Difficulty level of the recipe in English",
        "enum": ["easy", "medium", "hard"],
      },
      "portions": {
        "type": "number",
        "description": "Number of portions the recipe makes.",
      },
      "kitchenTools": {
        "type": "array",
        "description":
          "List of the kitchen tools for the recipe found in the Utensilios y herramientas útiles or Useful tools and utensils section.",
        "items": {
          "type": "object",
          "properties": {
            "translations": {
              "type": "array",
              "description": "Locale-keyed translations for this kitchen tool.",
              "items": {
                "type": "object",
                "properties": {
                  "locale": {
                    "type": "string",
                    "description": "Locale code, e.g. 'en' or 'es'.",
                  },
                  "name": {
                    "type": "string",
                    "description": "Kitchen tool name in this locale.",
                  },
                  "notes": {
                    "type": "string",
                    "description":
                      "Additional notes or tips about the kitchen tool in this locale.",
                  },
                },
                "required": ["locale", "name", "notes"],
                "additionalProperties": false,
              },
            },
            "displayOrder": {
              "type": "number",
              "description":
                "1-based index indicating the order of the kitchen tool.",
            },
          },
          "required": [
            "translations",
            "displayOrder",
          ],
          "additionalProperties": false,
        },
      },
      "ingredients": {
        "type": "array",
        "description": "List of the ingredients required for the recipe.",
        "items": {
          "type": "object",
          "properties": {
            "ingredient": {
              "type": "object",
              "description": "Ingredient details",
              "properties": {
                "translations": {
                  "type": "array",
                  "description":
                    "Locale-keyed translations for this ingredient.",
                  "items": {
                    "type": "object",
                    "properties": {
                      "locale": {
                        "type": "string",
                        "description": "Locale code, e.g. 'en' or 'es'.",
                      },
                      "name": {
                        "type": "string",
                        "description":
                          "Only the ingredient name in this locale, no quantities, no adjectives, no descriptions, or notes.",
                      },
                      "pluralName": {
                        "type": "string",
                        "description":
                          "Only the plural ingredient name in this locale, no quantities, no adjectives, no descriptions, or notes.",
                      },
                    },
                    "required": ["locale", "name", "pluralName"],
                    "additionalProperties": false,
                  },
                },
              },
              "required": ["translations"],
              "additionalProperties": false,
            },
            "quantity": {
              "type": "number",
              "description": "Quantity of the ingredient.",
            },
            "measurementUnitID": {
              "type": "string",
              "description": "The measurement unit of the ingredient if any.",
              "enum": [
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
              ],
              "default": "unit",
            },
            "translations": {
              "type": "array",
              "description":
                "Locale-keyed translations for ingredient notes, tips, and section.",
              "items": {
                "type": "object",
                "properties": {
                  "locale": {
                    "type": "string",
                    "description": "Locale code, e.g. 'en' or 'es'.",
                  },
                  "notes": {
                    "type": "string",
                    "description":
                      "Any additional preparation notes in this locale.",
                  },
                  "tip": {
                    "type": "string",
                    "description":
                      "Any tip included in the ingredient in this locale.",
                  },
                  "recipeSection": {
                    "type": "string",
                    "description":
                      "If the recipe has multiple components or meals made, the title of section if one is found, otherwise use 'Main' for English or 'Principal' for Spanish.",
                  },
                },
                "required": ["locale", "notes", "tip", "recipeSection"],
                "additionalProperties": false,
              },
            },
            "displayOrder": {
              "type": "number",
              "description":
                "1-based index indicating the order of the ingredient.",
            },
          },
          "required": [
            "quantity",
            "measurementUnitID",
            "ingredient",
            "translations",
            "displayOrder",
          ],
          "additionalProperties": false,
        },
      },
      "steps": {
        "type": "array",
        "description": "List of steps.",
        "items": {
          "type": "object",
          "properties": {
            "order": {
              "type": "number",
              "description":
                "1-based index indicating the order of the instruction.",
            },
            "translations": {
              "type": "array",
              "description":
                "Locale-keyed translations for instruction, tip, and section.",
              "items": {
                "type": "object",
                "properties": {
                  "locale": {
                    "type": "string",
                    "description": "Locale code, e.g. 'en' or 'es'.",
                  },
                  "instruction": {
                    "type": "string",
                    "description": "Full instruction text in this locale.",
                  },
                  "tip": {
                    "type": "string",
                    "description":
                      "Tip for this recipe step if one exists in this locale.",
                  },
                  "recipeSection": {
                    "type": "string",
                    "description":
                      "If the recipe has multiple components or meals made, the title of section if one is found, otherwise use 'Main' for English or 'Principal' for Spanish.",
                  },
                },
                "required": [
                  "locale",
                  "instruction",
                  "tip",
                  "recipeSection",
                ],
                "additionalProperties": false,
              },
            },
            "thermomixTime": {
              "type": ["number", "null"],
              "description":
                "Time in seconds, extracted from thermomix patterns in the instruction text.",
            },
            "thermomixTemperature": {
              "type": ["number", "string", "null"],
              "description":
                "Temperature section extracted from thermomix patterns. If no temperature is found, return null.",
              "enum": [
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
              ],
            },
            "thermomixTemperatureUnit": {
              "type": ["number", "null"],
              "description":
                "Temperature unit in C or F, if it exists, null otherwise",
            },
            "thermomixSpeed": {
              "type": ["object", "null"],
              "description":
                "Speed section extracted from thermomix patterns. Can be a single value or a range.",
              "properties": {
                "type": {
                  "type": "string",
                  "enum": ["single", "range"],
                  "description":
                    "Type of speed, either 'single' or 'range'. Single is only when there is one speed. Range when there are two speeds, generally formatted {number}-{number}, example: 3-5",
                },
                "value": {
                  "type": ["number", "string", "null"],
                  "enum": [
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
                  ],
                  "description":
                    "Speed value, a single value that only exists if the type is 'single', otherwise it is null.",
                },
                "start": {
                  "type": ["number", "string", "null"],
                  "enum": [
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
                  ],
                  "description":
                    "Start value, only exists if the type is 'range', otherwise it is null.",
                },
                "end": {
                  "type": ["number", "string", "null"],
                  "enum": [
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
                  ],
                  "description":
                    "End value, only exists if the type is 'range', otherwise it is null.",
                },
              },
              "required": ["type", "value", "start", "end"],
              "additionalProperties": false,
            },
            "thermomixIsBladeReversed": {
              "type": ["boolean", "null"],
              "description":
                "Reverse blade section extracted from thermomix patterns.",
            },
            "ingredients": {
              "type": "array",
              "description":
                "List of information that is related to the ingredients used in this step.",
              "items": {
                "type": "object",
                "properties": {
                  "ingredient": {
                    "type": "object",
                    "description": "Ingredient details",
                    "properties": {
                      "translations": {
                        "type": "array",
                        "description":
                          "Locale-keyed translations for this ingredient.",
                        "items": {
                          "type": "object",
                          "properties": {
                            "locale": {
                              "type": "string",
                              "description": "Locale code, e.g. 'en' or 'es'.",
                            },
                            "name": {
                              "type": "string",
                              "description":
                                "Only the ingredient name in this locale, no quantities, no adjectives, no descriptions, or notes.",
                            },
                            "pluralName": {
                              "type": "string",
                              "description":
                                "Only the plural ingredient name in this locale, no quantities, no adjectives, no descriptions, or notes.",
                            },
                          },
                          "required": ["locale", "name", "pluralName"],
                          "additionalProperties": false,
                        },
                      },
                    },
                    "required": [
                      "translations",
                    ],
                    "additionalProperties": false,
                  },
                  "quantity": {
                    "type": "number",
                    "description": "Quantity of the ingredient.",
                  },
                  "measurementUnitID": {
                    "type": "string",
                    "description":
                      "The measurement unit of the ingredient if any.",
                    "enum": [
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
                    ],
                    "default": "unit",
                  },
                  "displayOrder": {
                    "type": "number",
                    "description":
                      "1-based index indicating the order of the ingredient as it appears in the instruction text.",
                  },
                },
                "required": [
                  "ingredient",
                  "quantity",
                  "measurementUnitID",
                  "displayOrder",
                ],
                "additionalProperties": false,
              },
            },
          },
          "required": [
            "order",
            "translations",
            "thermomixTime",
            "thermomixTemperature",
            "thermomixTemperatureUnit",
            "thermomixSpeed",
            "thermomixIsBladeReversed",
            "ingredients",
          ],
          "additionalProperties": false,
        },
      },
      "tags": {
        "type": "array",
        "description":
          "List of all tags from both English and Spanish sections.",
        "items": {
          "type": "string",
          "description":
            "Tags can be prefixed with a #, remove the # from the tag name.",
        },
      },
    },
    "required": [
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
    "additionalProperties": false,
  },
  "strict": true,
};

const systemPrompt = `
You are a recipe parser specializing in converting Markdown recipes into structured JSON data.

You will receive data about a recipe, the recipe comes in two languages English and Spanish.
In the Spanish section of the recipe, it is structured into different parts: Ingredientes, Procedimiento, Tips, Utensilios y herramientas útiles, Tags.
In the English section of the recipe, it is structured into different parts: Ingredients, Instructions (a.k.a. steps), Tips, Useful tools and utensils, Tags.

For Thermomix instructions, extract the Thermomix parameters from patterns like "(40 sec/reverse blades/speed 3)" or "(45 sec/speed 3)".

DO NOT make up any information.
DO NOT include any information that is not found in the recipe.
DO NOT include ingredients that are not found in the recipe.
DO NOT include kitchen tools that are not found in the recipe.
DO NOT include tags that are not found in the recipe.
DO NOT include tips that are not found in the recipe.
DO NOT include steps that are not found in the recipe.

`;

serve(async (req: Request) => {
  const requestId = crypto.randomUUID(); // Generate unique ID for request tracing
  const startTime = performance.now();

  console.info(`[${requestId}] New request received: ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    console.info(`[${requestId}] Handling OPTIONS request`);
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

  if (!hasRole(user, "admin")) {
    console.warn(`[${requestId}] User ${user.id} attempted admin-only action`);
    return forbiddenResponse("Admin access required", corsHeaders);
  }

  console.info(`[${requestId}] Authenticated admin user: ${user.id}`);

  try {
    const { markdown } = await req.json();
    console.info(
      `[${requestId}] Received markdown of length: ${markdown?.length || 0}`,
    );

    if (!markdown) {
      console.warn(`[${requestId}] Missing markdown content`);
      return new Response(
        JSON.stringify({ error: "Markdown content is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    console.info(`[${requestId}] Calling AI gateway...`);
    const response = await chat({
      usageType: "parsing",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: markdown },
      ],
      temperature: 1,
      maxTokens: 10000,
      responseFormat: {
        type: "json_schema",
        schema: jsonSchema.schema,
      },
    });

    const content = response.content || null;

    if (!content) {
      console.error(
        `[${requestId}] Missing content from AI response`,
      );
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
      `[${requestId}] Successfully processed request in ${
        processingTime.toFixed(2)
      }ms`,
    );

    return new Response(
      JSON.stringify(content),
      { headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorCause = error instanceof Error ? error.cause : undefined;

    console.error(`[${requestId}] Error processing request:`, {
      message: errorMessage,
      stack: errorStack,
      cause: errorCause,
    });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});
