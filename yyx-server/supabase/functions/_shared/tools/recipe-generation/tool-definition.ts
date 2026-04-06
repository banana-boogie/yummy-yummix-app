/**
 * Tool definition for generate_custom_recipe (OpenAI Function Calling format).
 */

export const generateCustomRecipeTool = {
  type: "function" as const,
  function: {
    name: "generate_custom_recipe",
    description:
      "Generate a custom recipe when the user wants a specific dish that isn't in the database, " +
      "or when they ask you to make/create a recipe. Also use this when search_recipes returned " +
      "results that don't match what the user wanted. " +
      "The user must have provided SPECIFIC details: a dish name (e.g. 'mole') or ingredients (e.g. 'chicken and rice'). " +
      "If the user is vague ('make me something', 'I don't know'), ask them what they want first — do NOT call this tool. " +
      "Use their ingredients as the foundation and add complementary ones creatively (seasonings, herbs, pantry staples). " +
      "Never contradict the user's intent (e.g. dessert must be a dessert).",
    parameters: {
      type: "object",
      properties: {
        recipeDescription: {
          type: "string",
          description:
            'What the user wants to eat — the dish concept (e.g. "banana bread loaf", "creamy chicken pasta", "chocolate lava cake"). Always pass this when the user has a specific dish in mind.',
        },
        ingredients: {
          type: "array",
          items: { type: "string" },
          description:
            'List of ingredients the user has available (e.g., ["chicken", "rice", "broccoli"])',
        },
        cuisinePreference: {
          type: "string",
          description:
            'Preferred cuisine style (e.g., "Italian", "Mexican", "Asian", "Mediterranean")',
        },
        targetTime: {
          type: "integer",
          description: "Target total time in minutes",
          minimum: 5,
          maximum: 480,
        },
        difficulty: {
          type: "string",
          enum: ["easy", "medium", "hard"],
          description: "Desired difficulty level",
        },
        portions: {
          type: "integer",
          description:
            "Number of portions/servings. Infer from conversation (e.g. 'for 2', 'family dinner'). Omit to use user's default.",
          minimum: 1,
          maximum: 50,
        },
        additionalRequests: {
          type: "string",
          description:
            'Additional requests, constraints, or modifications (e.g., "make it spicy", "increase to 8 portions", "kid-friendly")',
        },
        kitchen_tools: {
          type: "array",
          items: { type: "string" },
          description:
            'Additional kitchen equipment for this recipe (e.g., ["thermomix", "air fryer"]). Supplements the user\'s general equipment preferences.',
        },
      },
      required: ["ingredients"],
    },
  },
};
