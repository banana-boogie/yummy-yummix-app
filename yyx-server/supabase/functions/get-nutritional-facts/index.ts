//@ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
//@ts-ignore
import OpenAI from "https://deno.land/x/openai@v4.69.0/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  applyRoundingRulesToData,
  convertToPer100g,
  type NutritionalData,
  validateNutritionalData,
} from "../_shared/nutritional-utils.ts";

class USDAService {
  private static API_KEY = Deno.env.get("USDA_API_KEY");
  private static BASE_URL = "https://api.nal.usda.gov/fdc/v1";

  static async getNutritionalFacts(
    ingredientName: string,
  ): Promise<NutritionalData | null> {
    console.info(`Looking up nutrition for '${ingredientName}' via USDA`);
    try {
      const queryParams = new URLSearchParams({
        api_key: this.API_KEY || "",
        query: ingredientName,
        pageSize: "1",
        dataType: "Foundation",
        format: "full",
      });

      const searchUrl = `${this.BASE_URL}/foods/search?${queryParams}`;
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      if (!searchData.foods || searchData.foods.length === 0) {
        console.info(`No USDA data found for '${ingredientName}'`);
        return null;
      }

      const food = searchData.foods[0];
      console.info(`Found USDA match: '${food.description}'`);

      const portionSize = this.getPortionSize(food);
      const nutrients = food.foodNutrients;
      const result = {
        calories: this.findNutrient(nutrients, "Energy") || 0,
        protein: this.findNutrient(nutrients, "Protein") || 0,
        fat: this.findNutrient(nutrients, "Total lipid (fat)") || 0,
        carbohydrates:
          this.findNutrient(nutrients, "Carbohydrate, by difference") || 0,
      };

      // Convert values to per 100g if needed
      if (portionSize && portionSize !== 100) {
        convertToPer100g(result, portionSize);
      }

      applyRoundingRulesToData(result);

      return result;
    } catch (error) {
      console.error(`USDA API error for '${ingredientName}':`, error);
      return null;
    }
  }

  private static findNutrient(nutrients: any[], name: string): number | null {
    const nutrient = nutrients.find((n) => n.nutrientName === name);
    return nutrient ? Number(nutrient.value) : null;
  }

  private static getPortionSize(food: any): number | null {
    if (food.dataType === "Foundation") {
      return 100;
    }

    return null;
  }
}

class OpenAIService {
  private static client = new OpenAI({
    apiKey: Deno.env.get("OPENAI_API_KEY"),
    fetch: fetch,
  });

  static async getNutritionalFacts(
    ingredientName: string,
  ): Promise<NutritionalData | null> {
    console.info(`Looking up nutrition for '${ingredientName}' via OpenAI`);
    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content:
            `Provide nutritional facts per 100g for ${ingredientName}. Return ONLY a JSON object in this exact format: {"calories": number, "protein": number, "fat": number, "carbohydrates": number}`,
        }],
        temperature: 0.3,
      });

      if (!completion.choices[0]?.message?.content) {
        console.warn(`No content in OpenAI response for '${ingredientName}'`);
        return null;
      }

      try {
        const nutritionalData = JSON.parse(
          completion.choices[0].message.content,
        );

        if (validateNutritionalData(nutritionalData)) {
          console.info(
            `Successfully retrieved OpenAI nutrition data for '${ingredientName}'`,
          );
          applyRoundingRulesToData(nutritionalData);
          return nutritionalData;
        } else {
          console.warn(
            `Invalid nutrition data format from OpenAI for '${ingredientName}'`,
          );
          return null;
        }
      } catch (parseError) {
        console.error(`JSON parse error for '${ingredientName}'`);
        return null;
      }
    } catch (error) {
      console.error(`OpenAI service error for '${ingredientName}':`, error);
      return null;
    }
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

    let nutritionalFacts = await USDAService.getNutritionalFacts(
      ingredientName,
    );

    if (!nutritionalFacts) {
      console.info(`USDA lookup failed for '${ingredientName}', trying OpenAI`);
      nutritionalFacts = await OpenAIService.getNutritionalFacts(
        ingredientName,
      );
    }

    if (!nutritionalFacts) {
      return new Response(
        JSON.stringify({ error: "Could not find nutritional facts" }),
        { status: 404 },
      );
    }

    console.info(
      `Successfully retrieved nutrition data for '${ingredientName}'`,
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
