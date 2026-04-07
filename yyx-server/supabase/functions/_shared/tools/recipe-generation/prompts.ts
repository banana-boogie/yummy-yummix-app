/**
 * Prompt construction and JSON schema for recipe generation.
 *
 * Contains:
 * - System prompt (equipment-aware, locale-aware)
 * - User prompt builder (preference hierarchy)
 * - JSON schema for structured LLM output
 */

import type { UserContext } from "../../irmixy-schemas.ts";
import type { GenerateRecipeParams } from "../tool-validators.ts";
import {
  getThermomixModel,
  hasAirFryer,
  hasThermomix,
} from "../../equipment-utils.ts";
import { getLanguageName } from "../../locale-utils.ts";

// ============================================================
// JSON Schema
// ============================================================

/**
 * Build a JSON schema for structured output based on whether user has Thermomix.
 * Non-Thermomix users get a simpler schema (fewer output tokens).
 * Exported for testing.
 */
export function buildRecipeJsonSchema(
  hasThermomix: boolean,
): Record<string, unknown> {
  const stepProperties: Record<string, unknown> = {
    order: { type: "integer" },
    instruction: { type: "string" },
    ingredientsUsed: { type: "array", items: { type: "string" } },
  };
  const stepRequired = ["order", "instruction", "ingredientsUsed"];

  if (hasThermomix) {
    stepProperties.thermomixTime = { type: ["integer", "null"] };
    stepProperties.thermomixTemp = { type: ["string", "null"] };
    stepProperties.thermomixSpeed = { type: ["string", "null"] };
    stepProperties.thermomixMode = { type: ["string", "null"] };
    stepRequired.push(
      "thermomixTime",
      "thermomixTemp",
      "thermomixSpeed",
      "thermomixMode",
    );
  }

  // Timer field — for non-Thermomix steps with a specific duration
  stepProperties.timerSeconds = {
    type: ["integer", "null"],
    description:
      "Duration in seconds for non-Thermomix steps that have a specific time duration. Thermomix steps use thermomixTime instead — never set both. Examples: let dough rise 30 min → 1800, marinate 15 min → 900.",
  };
  stepRequired.push("timerSeconds");

  // Tips field — always included regardless of equipment
  stepProperties.tip = {
    type: ["string", "null"],
    description:
      "Optional practical cooking tip for this step. Short, actionable advice: technique, timing, doneness cues, substitutions, or equipment tips. 1-2 sentences max. Null for straightforward steps.",
  };
  stepRequired.push("tip");

  return {
    type: "object",
    properties: {
      schemaVersion: { type: "string", enum: ["1.0"] },
      suggestedName: { type: "string" },
      description: { type: "string" },
      measurementSystem: { type: "string", enum: ["imperial", "metric"] },
      locale: { type: "string" },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
          },
          required: ["name", "quantity", "unit"],
          additionalProperties: false,
        },
      },
      steps: {
        type: "array",
        items: {
          type: "object",
          properties: stepProperties,
          required: stepRequired,
          additionalProperties: false,
        },
      },
      totalTime: { type: "integer" },
      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
      portions: { type: "integer" },
      tags: { type: "array", items: { type: "string" } },
      kitchenTools: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            notes: { type: ["string", "null"] },
          },
          required: ["name", "notes"],
          additionalProperties: false,
        },
      },
    },
    required: [
      "schemaVersion",
      "suggestedName",
      "description",
      "measurementSystem",
      "locale",
      "ingredients",
      "steps",
      "totalTime",
      "difficulty",
      "portions",
      "tags",
      "kitchenTools",
    ],
    additionalProperties: false,
  };
}

// ============================================================
// System Prompt
// ============================================================

/**
 * Build the system prompt for recipe generation.
 */
export function getSystemPrompt(userContext: UserContext): string {
  const lang = getLanguageName(userContext.locale);
  const units = userContext.measurementSystem === "imperial"
    ? "cups, tablespoons, teaspoons, ounces, pounds, °F"
    : "ml, liters, grams, kg, °C";

  const isThermomixUser = hasThermomix(userContext.kitchenEquipment);
  const isAirFryerUser = hasAirFryer(userContext.kitchenEquipment);
  const thermomixModel = isThermomixUser
    ? getThermomixModel(userContext.kitchenEquipment)
    : null;

  if (
    !isThermomixUser && !isAirFryerUser &&
    userContext.kitchenEquipment.length > 0
  ) {
    console.warn(
      "[Recipe Generation] User has equipment but no Thermomix or Air Fryer:",
      userContext.kitchenEquipment,
    );
  }

  // Build model-aware temperature guide
  const isTM7 = thermomixModel === "TM7";
  const maxManualTemp = isTM7 ? "160°C" : "120°C";
  const modelLabel = thermomixModel ?? "TM6";

  const temperatureGuide = isTM7
    ? `TEMPERATURE GUIDE (TM7 — manual up to 160°C):
- 37-50°C: Melting chocolate/butter, warming
- 60-90°C: Simmering sauces, custards, béchamel
- 90-100°C: Boiling, cooking rice/pasta, soups, stews
- 100-120°C: Sautéing, caramelizing, light browning
- 120-160°C: Higher-heat browning, searing, deep caramelization
- Varoma: Steam cooking (needs 500ml+ water in bowl, speed 2)`
    : `TEMPERATURE GUIDE (${modelLabel} — manual up to 120°C):
- 37-50°C: Melting chocolate/butter, warming
- 60-90°C: Simmering sauces, custards, béchamel
- 90-100°C: Boiling, cooking rice/pasta, soups, stews
- 100-120°C: Sautéing, caramelizing, browning
- Varoma: Steam cooking (needs 500ml+ water in bowl, speed 2)`;

  const openCookingNote = isTM7
    ? `\nOPEN COOKING (TM7 only): No blade rotation. Temperature + time only. Stir manually with spatula. Lid is unlocked. Up to 100°C. This is a dedicated cooking mode — NOT manual cooking with the lid open.`
    : "";

  const cutterNote = isTM7
    ? `- Cutter+ accessory: Speed 4 only, max 28oz. For uniform slicing/grating of firm vegetables and hard cheese.`
    : `- Cutter disc accessory: Speed 4 only, max 28oz. For uniform slicing/grating of firm vegetables and hard cheese.`;

  const thermomixSection = isThermomixUser
    ? `

## THERMOMIX USAGE (User has a Thermomix ${modelLabel} — you are an expert Thermomix cook)

Choose optimal time, speed, temperature, and cooking mode for each step based on the technique.

PARAMETERS:
- **thermomixTime** (seconds) and **thermomixSpeed** ("1"-"10", "Spoon", or "Reverse") are a REQUIRED PAIR — if you set one, you MUST set both.
- **thermomixTemp** ("37°C"-"${maxManualTemp}" or "Varoma") is OPTIONAL — only when the step needs heat. Null = no heat (chopping, blending, kneading).
- **thermomixMode** is OPTIONAL — set it when the step uses a named cooking mode. Null = manual mode (the default).

COOKING MODES (set thermomixMode when applicable):
- "slow_cook": Reverse, Speed 1, blade cover, 70-100°C, up to 12h. For stews, braises, casseroles.${
      isTM7 ? "" : " (TM6: available)"
    }
- "rice_cooker": Automatic temp/speed/time for rice and grains.
- "sous_vide": Precise temp hold, no stirring. For proteins, vegetables.
- "fermentation": Low temp hold (30-45°C), extended time. For yogurt, dough proofing, tempeh. Available on both TM6 and TM7.
- "dough": Kneading mode, max 500g flour. For bread, pasta, pizza dough.
- "turbo": Brief pulse at max speed. For crushing ice, quick grind.
${
      isTM7
        ? `- "browning": 120-160°C, max 10min per step. NO speed setting — always set thermomixSpeed to null. Cannot be combined with open_cooking (lid must be closed). Two intensity levels — "gentle" (vegetables, onions, garlic, delicate browning) and "intense" (searing meats, deep caramelization). (TM7 only)
- "open_cooking": No blade rotation. Temperature + time only. Stir manually with spatula. Lid is unlocked. Up to 100°C. A dedicated cooking mode — NOT manual cooking with lid open. Cannot be combined with browning. (TM7 only)`
        : ""
    }

SPEED GUIDE:
- Spoon/1-2: Gentle stirring, simmering, slow cooking (cooking speeds)
- 3-5: Mixing, rough chopping
- 5-7: Fine chopping, sauces
- 7-10: Pureeing, grinding, blending, smoothies
- REVERSE: Use when cooking ingredients that must stay intact (stews, sautéing, pasta). Blunt edge stirs without cutting. Combine with Spoon/1-2.

${temperatureGuide}
${openCookingNote}
CRITICAL RULES:
- Above 60°C: max speed 6. Never use high speeds with hot food.
- Chopping is SECONDS (3-10 sec), not minutes. Start short, check.
- Sautéing always uses Reverse (e.g. ${
      isTM7 ? "140°C" : "120°C"
    } / Reverse / Speed 1 / 5-10 min).
- Browning/searing: 100-250g per batch, blade rotates in this mode. For larger quantities (>250g), recommend using a pan or skillet instead.
- Delicate formed items (meatballs, dumplings, stuffed pasta): NEVER brown in the Thermomix bowl. Blade rotation destroys them. Pan-fry or oven-bake instead.
- When a step uses a mixture from a previous step, reference it as "the [name] mixture" in instructions. In ingredientsUsed, list only NEW ingredients added in this step — not the components of an already-combined mixture.

Skip Thermomix for: plating, garnishing, oven/grill tasks, manual shaping — leave all four params null.
Set timerSeconds for ANY non-Thermomix step with a specific time duration: searing, frying, grilling, simmering, roasting, baking, oven time, air-fryer time, reducing, steeping, cooling, resting, marinating, chilling. If the step says "sear for 3 minutes", set timerSeconds: 180. If a manual action happens after a timed interval (e.g., flip after searing), split it into a separate step. Never set both timerSeconds and thermomixTime on the same step.

PHYSICAL CONSTRAINTS (bowl = 2.2 liters):
- Total volume of ingredients + liquid must not exceed 2.2L. For hot foods (soups, stews), keep under 1.8L.
- Dough: max 500g flour per batch.
- Browning/searing: 100-250g per batch. Multiple batches for larger quantities.
- Slow cooking meat: max 800g per batch.
- Above 95°C: replace measuring cup with simmering basket.
- Speed 7+: measuring cup MUST be in place.
- Butterfly whisk: max speed 4.
${cutterNote}
- If the recipe exceeds bowl capacity, instruct to cook in batches and note it in a tip.

Examples:
- Sauté: {"order": 2, "instruction": "Sauté onions", "ingredientsUsed": ["onion"], "thermomixTime": 300, "thermomixTemp": "100°C", "thermomixSpeed": "Reverse", "thermomixMode": null, "tip": "The onion is ready when translucent, about 3-4 minutes."}
- Chop: {"order": 1, "instruction": "Chop vegetables", "ingredientsUsed": ["carrot"], "thermomixTime": 5, "thermomixTemp": null, "thermomixSpeed": "5", "thermomixMode": null, "tip": "Start with 3-second pulses and check — you can always chop more."}
- Steam: {"order": 3, "instruction": "Steam vegetables in Varoma", "ingredientsUsed": ["broccoli", "zucchini"], "thermomixTime": 1200, "thermomixTemp": "Varoma", "thermomixSpeed": "2", "thermomixMode": null, "tip": null}
- Slow Cook: {"order": 2, "instruction": "Slow cook the stew", "ingredientsUsed": ["beef", "potato"], "thermomixTime": 7200, "thermomixTemp": "90°C", "thermomixSpeed": "Reverse", "thermomixMode": "slow_cook", "tip": "Check after 1 hour — add water if needed."}
- Non-Thermomix: {"order": 5, "instruction": "Plate and garnish", "ingredientsUsed": ["parsley"], "thermomixTime": null, "thermomixTemp": null, "thermomixSpeed": null, "thermomixMode": null, "tip": null}`
    : "";

  const airFryerSection = isAirFryerUser
    ? `

## AIR FRYER USAGE (User owns Air Fryer — suggest it when it's the best tool for the job)

Use the Air Fryer for steps where it produces better results than conventional methods: crisping, roasting, reheating, and quick baking. Include Air Fryer temperature and time in the step instruction text.

BEST USES:
- Crisping/browning: proteins (chicken wings, fish fillets, chicken thighs), vegetables (broccoli, Brussels sprouts, cauliflower), breaded items
- Quick roasting: root vegetables, peppers, garlic
- Frozen foods: cook directly from frozen — nuggets, fries, breaded items (no thawing needed)
- Reheating: leftovers come out crispy, not soggy
- Baking small items: individual portions, small cakes
- Tofu: crispy exterior without pan-sticking

MEXICAN KITCHEN FAVORITES:
- Tostadas: lightly oil corn tortillas, air fry at 190°C for 4-5 minutes until crisp
- Tortilla chips: cut tortillas into triangles, light oil, 180°C for 5-7 minutes
- Empanadas: 190°C for 10-12 minutes until golden — crispy without deep frying
- Chimichangas: 200°C for 8-10 minutes, flipping halfway
- Churros: pipe and chill dough, air fry at 190°C for 8-10 minutes, coat in cinnamon sugar after
- Chiles rellenos (breaded): 180°C for 10-12 minutes — use dry breadcrumb coating, not wet batter
- Quesadillas: 190°C for 5-6 minutes for extra-crispy tortilla

TEMPERATURE GUIDE:
- 150-160°C (300-320°F): Delicate items, reheating, dehydrating
- 170-180°C (340-360°F): Chicken pieces, fish, roasted vegetables
- 190-200°C (375-400°F): Crispy items, fries, wings, empanadas, tostadas
- 200-220°C (400-430°F): Quick searing, very crispy finishes (short time only)

KEY RULES:
- Preheat 3-5 minutes for crispy results on proteins, vegetables, and reheating. Skip preheating for thick raw meats and baked goods — they cook better starting cold.
- Don't overcrowd the basket — air needs to circulate. For large batches, cook in rounds.
- Shake or flip halfway through for even cooking.
- Pat proteins and vegetables dry before cooking — moisture prevents crispiness.
- A light brush or mist of high smoke point oil (avocado, sunflower) improves crispiness. Avoid aerosol cooking sprays which damage nonstick coatings.
- Loose dry seasonings blow off in the airflow — use oil to help them stick, or season after cooking.
- Always verify meat reaches safe internal temperature (poultry: 74°C/165°F, beef/pork/fish: 63°C/145°F).
- Include temperature and time in the step instruction (e.g., "Air fry at 200°C for 12-15 minutes, shaking halfway").

WHEN NOT TO USE:
- Soups, stews, sauces, or anything liquid-based
- Large roasts or whole chickens that don't fit properly
- Wet batters (beer batter, tempura) — they drip through the basket. Use dry breadcrumb coatings instead.
- Loose leafy greens (they blow around and burn)
- Raw rice, pasta, or grains (need water immersion)
- When Thermomix or stovetop gives better results for that specific step

Example: {"order": 3, "instruction": "Place the chicken thighs in the air fryer basket in a single layer. Air fry at 190°C for 18-20 minutes, flipping halfway, until golden and cooked through.", "ingredientsUsed": ["chicken thighs"]}`
    : "";

  return `Expert cook and recipe writer. Output in ${lang}, ${userContext.measurementSystem} units (${units}).

RULES: Use practical quantities (e.g. 1/3 not 0.333, round to common fractions). Kitchen-friendly minimums: salt (min 1/4 tsp), spices/seeds (min 1/2 tsp), herbs (min 1 tbsp). Never output sub-gram quantities like "1g sesame seeds" — for small amounts use teaspoons/tablespoons. Name recipes naturally without ANY dietary or allergen labels — the title should sound like a cookbook, not a medical chart (GOOD: "Chicken Mole Poblano", BAD: "Nut-Free Chicken Mole", BAD: "Sugar-Free Ramen", BAD: "Gluten-Free Pasta"). Preferences guide creativity; ingredient dislikes are strict. Silently avoid allergen ingredients — never mention allergens, substitutions, or what was removed in the title, description, or step instructions.
${thermomixSection}
${airFryerSection}

## TIPS
Add a practical tip to steps where it genuinely helps. Good tips:
- Technique advice ("Chop while the Thermomix sautés to save time")
- Doneness cues ("The onion is ready when translucent, ~3-4 minutes")
- Make-ahead suggestions ("This sauce freezes well for up to 3 months")
- Equipment tips ("Use butterfly whisk for lighter textures")
- Substitution ideas ("No crema? Use Greek yogurt")
Keep tips short (1-2 sentences). Not every step needs a tip — only where it adds value. Set to null for simple steps.

## STEP READABILITY
- Each step should contain ONE primary action. The user reads one step at a time on their phone while cooking — they can't hold 3 actions in memory.
- Maximum 2 short sentences per step.
- If a step requires multiple distinct actions (e.g., season AND rest AND preheat), split them into separate steps.
- If a step contains "meanwhile" or a later manual action after waiting, split it into separate steps.
- No nested numbering, no inline mini-lists with semicolons, no "then…then…then" chains.
- If a manual action happens after a timed interval (e.g., flip after searing), split into a separate step with its own timerSeconds.

OUTPUT: Return ONLY valid JSON (no markdown, no code fences). Each step needs "ingredientsUsed" matching ingredient names exactly. Set "timerSeconds" for any non-Thermomix step with a specific time duration — it powers a countdown timer in the app. Include "kitchenTools" — kitchen tools and accessories that would be helpful for this recipe. Not just required tools, but things that make the cooking experience easier — like a waste bowl for peels and trimmings. Think like a seasoned home cook setting up their station.

Kitchen tool rules:
- Title case names: "Air Fryer" not "air_fryer". No underscores or snake_case.
- ONE tool per entry. Never combine tools with "or" — pick the primary one.
- Only list tools actually used in the recipe steps. If a step uses a tool, it must appear in kitchenTools. If a tool is in kitchenTools, at least one step must reference it.
- Use common names: "Spatula", "Mixing Bowl", "Baking Sheet", not branded or overly specific names.

Use this structure:
{"schemaVersion":"1.0","suggestedName":"...","description":"A brief 1-2 sentence description of the dish","measurementSystem":"${userContext.measurementSystem}","locale":"${userContext.locale}","ingredients":[{"name":"...","quantity":1,"unit":"..."}],"steps":[{"order":1,"instruction":"...","ingredientsUsed":["..."]}],"totalTime":30,"difficulty":"easy","portions":4,"tags":[],"kitchenTools":[{"name":"...","notes":"..."}]}`;
}

// ============================================================
// User Prompt
// ============================================================

/**
 * Build the user prompt with recipe requirements.
 *
 * Preference hierarchy:
 * 1. HARD REQUIREMENTS: Must be followed (allergies, ingredient dislikes)
 * 2. EXPLICIT REQUESTS: Cuisine/style from current request overrides defaults
 * 3. MEDIUM CONSTRAINTS: Diet types affect ingredient selection (vegan, keto, etc.)
 * 4. SOFT PREFERENCES: Cuisine preferences are inspirational only (not every recipe needs to match)
 */
export function buildRecipeGenerationPrompt(
  params: GenerateRecipeParams,
  userContext: UserContext,
  safetyReminders: string,
  options?: {
    allergenWarning?: string;
  },
): string {
  const parts: string[] = [];

  // Core request — dish concept first, then ingredients
  if (params.recipeDescription) {
    parts.push(`Create a recipe for: ${params.recipeDescription}`);
    parts.push(`Available ingredients: ${params.ingredients.join(", ")}`);
  } else {
    parts.push(
      `Create a recipe using these ingredients: ${
        params.ingredients.join(", ")
      }`,
    );
  }

  // Portions — explicit param > user default > fallback
  const portions = params.portions ?? userContext.householdSize ?? 4;
  parts.push(`Portions: ${portions}.`);

  // Time constraint
  if (params.targetTime) {
    parts.push(
      `Total time should be around ${params.targetTime} minutes or less.`,
    );
  }

  // Cuisine preference - explicit request takes priority
  if (params.cuisinePreference) {
    parts.push(`Style: ${params.cuisinePreference} cuisine.`);
  }

  // Difficulty
  if (params.difficulty) {
    parts.push(`Difficulty level: ${params.difficulty}.`);
  }

  if (params.additionalRequests) {
    parts.push(`Additional requirements: ${params.additionalRequests}`);
  }

  // === HARD REQUIREMENTS (must be followed) ===
  const requirements: string[] = [];

  if (userContext.ingredientDislikes.length > 0) {
    requirements.push(
      `MUST AVOID these ingredients: ${
        userContext.ingredientDislikes.join(", ")
      }`,
    );
  }

  if (requirements.length > 0) {
    parts.push("\n⚠️ HARD REQUIREMENTS (must follow):");
    parts.push(requirements.join("\n"));
  }

  // === MEDIUM CONSTRAINTS (diet types - affect ingredient selection) ===
  // Diet types like vegan, keto, paleo affect WHAT ingredients can be used
  // These are more than preferences but less than hard requirements
  if (userContext.dietTypes.length > 0) {
    const validDietTypes = userContext.dietTypes.filter((d) =>
      d !== "none" && d !== "other"
    );
    if (validDietTypes.length > 0) {
      parts.push("\n🥗 DIETARY APPROACH (follow for ingredient selection):");
      parts.push(`User follows: ${validDietTypes.join(", ")}`);
      parts.push(
        "Select ingredients compatible with these dietary approaches.",
      );
    }
  }

  // === EQUIPMENT (use where appropriate in the recipe) ===
  if (params.kitchen_tools && params.kitchen_tools.length > 0) {
    parts.push("\n🍳 EQUIPMENT for this recipe:");
    parts.push(
      `Use these where they fit best: ${params.kitchen_tools.join(", ")}`,
    );
  } else if (userContext.kitchenEquipment.length > 0) {
    parts.push("\n🍳 AVAILABLE EQUIPMENT:");
    parts.push(
      `User has: ${
        userContext.kitchenEquipment.join(", ")
      }. Use where appropriate for the best result.`,
    );
  }

  // === SOFT PREFERENCES (consider but don't force) ===
  // Cuisine preferences are SOFT/INSPIRATIONAL - they should NOT dominate every recipe
  // Only mention them if no explicit cuisine was requested, and frame them as hints
  if (
    userContext.cuisinePreferences &&
    userContext.cuisinePreferences.length > 0 && !params.cuisinePreference
  ) {
    const validCuisines = userContext.cuisinePreferences.filter((c) =>
      c && c.trim()
    );
    if (validCuisines.length > 0) {
      parts.push("\n📝 Soft preferences (consider but be creative):");
      parts.push(
        `Cuisine inspiration (OPTIONAL, vary styles): User enjoys ${
          validCuisines.join(", ")
        } cooking. ` +
          `Feel free to explore other cuisines that suit the ingredients - variety is welcome!`,
      );
    }
  }

  // Safety reminders
  if (safetyReminders) {
    parts.push(`\n${safetyReminders}`);
  }

  if (options?.allergenWarning) {
    parts.push("\n⚠️ ALLERGEN SAFETY NOTE:");
    parts.push(
      "Some ingredients may trigger allergen concerns for this user. " +
        "Silently avoid these ingredients — do NOT mention allergens, substitutions, or dietary accommodations in the recipe.",
    );
    parts.push(`Detected: ${options.allergenWarning}`);
  }

  return parts.join("\n");
}
