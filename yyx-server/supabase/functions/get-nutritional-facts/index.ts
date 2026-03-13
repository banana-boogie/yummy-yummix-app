//@ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { chat } from "../_shared/ai-gateway/index.ts";
import {
  applyRoundingRulesToData,
  type NutritionalData,
  validateNutritionalData,
} from "../_shared/nutritional-utils.ts";

async function getNutritionalFacts(
  ingredientName: string,
): Promise<NutritionalData | null> {
  console.info(`Looking up nutrition for '${ingredientName}' via AI gateway`);
  try {
    const response = await chat({
      usageType: "parsing",
      messages: [{
        role: "user",
        content:
          `Provide nutritional facts per 100g for raw/unprocessed "${ingredientName}". Use USDA reference values. Return ONLY a JSON object in this exact format: {"calories": number, "protein": number, "fat": number, "carbohydrates": number}`,
      }],
      temperature: 0,
      responseFormat: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            calories: { type: "number" },
            protein: { type: "number" },
            fat: { type: "number" },
            carbohydrates: { type: "number" },
          },
          required: ["calories", "protein", "fat", "carbohydrates"],
          additionalProperties: false,
        },
      },
    });

    if (!response.content) {
      console.warn(`No content in AI response for '${ingredientName}'`);
      return null;
    }

    const nutritionalData = JSON.parse(response.content);

    if (validateNutritionalData(nutritionalData)) {
      console.info(
        `Successfully retrieved nutrition data for '${ingredientName}': ${
          JSON.stringify(nutritionalData)
        }`,
      );
      applyRoundingRulesToData(nutritionalData);
      return nutritionalData;
    } else {
      console.warn(
        `Invalid nutrition data format from AI for '${ingredientName}'`,
      );
      return null;
    }
  } catch (error) {
    console.error(`Nutrition lookup error for '${ingredientName}':`, error);
    return null;
  }
}

serve(async (req) => {
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const requestId = crypto.randomUUID();
  console.info(`Request ${requestId} started`);

  try {
    const body = await req.json();
    const { ingredientName } = body;

    if (!ingredientName) {
      return new Response(
        JSON.stringify({ error: "Ingredient name is required" }),
        { status: 400 },
      );
    }

    const nutritionalFacts = await getNutritionalFacts(ingredientName);

    if (!nutritionalFacts) {
      return new Response(
        JSON.stringify({ error: "Could not find nutritional facts" }),
        { status: 404 },
      );
    }

    console.info(
      `Request ${requestId} completed for '${ingredientName}'`,
    );
    return new Response(
      JSON.stringify({ per_100g: nutritionalFacts }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 200,
      },
    );
  } catch (error) {
    console.error(`Request ${requestId} failed:`, error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 },
    );
  }
});
