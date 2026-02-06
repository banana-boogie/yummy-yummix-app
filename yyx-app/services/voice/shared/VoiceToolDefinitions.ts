/**
 * Voice Tool Definitions
 *
 * Tool schemas for OpenAI Realtime session config.
 * Mirrors the server-side tool definitions for search_recipes and generate_custom_recipe.
 */

export const voiceTools = [
    {
        type: "function" as const,
        name: "search_recipes",
        description:
            "Search the recipe database for existing recipes based on user criteria. " +
            "Use this when the user wants to find recipes from the database (not create custom ones). " +
            "Returns recipe cards that match the filters. Results are automatically filtered by " +
            "the user's dietary restrictions and allergens.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description:
                        'Natural language search query (e.g., "pasta", "healthy dinner", "chicken stir fry")',
                },
                cuisine: {
                    type: "string",
                    description:
                        'Cuisine type filter (e.g., "Italian", "Asian", "Mexican", "Mediterranean")',
                },
                maxTime: {
                    type: "integer",
                    description: "Maximum total cooking time in minutes",
                },
                difficulty: {
                    type: "string",
                    enum: ["easy", "medium", "hard"],
                    description: "Recipe difficulty level",
                },
                limit: {
                    type: "integer",
                    description: "Maximum number of results to return (default: 5)",
                },
            },
            required: [],
        },
    },
    {
        type: "function" as const,
        name: "generate_custom_recipe",
        description:
            "Generate a custom recipe based on ingredients the user has available. " +
            "Use this when the user wants to create a new recipe from scratch, " +
            "tells you what ingredients they have, or asks what they can make. " +
            "Before calling this tool, gather at least: ingredients and time available. " +
            "Cuisine preference is helpful but optional.",
        parameters: {
            type: "object",
            properties: {
                ingredients: {
                    type: "array",
                    items: { type: "string" },
                    description:
                        'List of ingredients the user has available (e.g., ["chicken", "rice", "broccoli"])',
                },
                cuisinePreference: {
                    type: "string",
                    description:
                        'Preferred cuisine style (e.g., "Italian", "Mexican", "Asian")',
                },
                targetTime: {
                    type: "integer",
                    description: "Target total time in minutes",
                },
                difficulty: {
                    type: "string",
                    enum: ["easy", "medium", "hard"],
                    description: "Desired difficulty level",
                },
                additionalRequests: {
                    type: "string",
                    description:
                        'Additional requests or constraints (e.g., "make it spicy", "kid-friendly")',
                },
                useful_items: {
                    type: "array",
                    items: { type: "string" },
                    description:
                        'Specific kitchen equipment to prioritize (e.g., ["thermomix", "air fryer"])',
                },
            },
            required: ["ingredients"],
        },
    },
];
