/**
 * Meal Context Detection
 *
 * Detects meal type and time preferences from user messages.
 * Supports both English and Spanish.
 */

/**
 * Detect meal context from user message.
 * Identifies meal type and time preferences.
 */
export function detectMealContext(message: string): {
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  timePreference?: "quick" | "normal" | "elaborate";
} {
  const lowerMessage = message.toLowerCase();

  // Meal type detection (multilingual)
  const mealPatterns = {
    breakfast: /breakfast|desayuno|morning|ma[ñn]ana|brunch/i,
    lunch: /lunch|almuerzo|comida|noon|mediod[íi]a/i,
    dinner: /dinner|cena|supper|evening|noche/i,
    snack: /snack|aperitivo|merienda|appetizer|botana/i,
  };

  let mealType: "breakfast" | "lunch" | "dinner" | "snack" | undefined;
  for (const [type, pattern] of Object.entries(mealPatterns)) {
    if (pattern.test(lowerMessage)) {
      mealType = type as "breakfast" | "lunch" | "dinner" | "snack";
      break;
    }
  }

  // Time preference detection
  const quickPatterns = /quick|fast|r[aá]pido|30 min|simple|easy/i;
  const elaboratePatterns =
    /elaborate|fancy|special|complejo|elegante|gourmet/i;

  let timePreference: "quick" | "normal" | "elaborate" | undefined;
  if (quickPatterns.test(lowerMessage)) {
    timePreference = "quick";
  } else if (elaboratePatterns.test(lowerMessage)) {
    timePreference = "elaborate";
  }

  return { mealType, timePreference };
}
