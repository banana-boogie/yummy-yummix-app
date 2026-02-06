/**
 * Recipe intent detection helpers.
 * Shared between orchestrator runtime and tests to prevent logic drift.
 */

// Direct recipe request patterns (EN)
const ENGLISH_RECIPE_PATTERNS = [
  /\b(?:make|create|generate|give)\s+(?:me\s+)?(?:a\s+)?recipe/i,
  /\brecipe\s+(?:for|with|using)\b/i,
  /\bwhat\s+(?:can|should)\s+i\s+(?:make|cook|prepare)\b/i,
  /\b(?:quick|fast|easy|simple)\s+(?:\d+[- ]?min(?:ute)?s?\s+)?(?:meal|dish|dinner|lunch|breakfast)/i,
  /\bcook\s+(?:me\s+)?(?:something|a\s+meal)/i,
  /\bi\s+(?:want|need)\s+(?:a\s+)?(?:recipe|meal|dish)/i,
  /\bhelp\s+me\s+(?:make|cook|prepare)/i,
];

// Direct recipe request patterns (ES)
const SPANISH_RECIPE_PATTERNS = [
  /\b(?:hazme|haz|crea|genera|dame)\s+(?:una?\s+)?receta/i,
  /\breceta\s+(?:de|con|para|usando)\b/i,
  /\bqu[ée]\s+(?:puedo|debo)\s+(?:hacer|cocinar|preparar)\b/i,
  /\b(?:comida|plato|cena|almuerzo|desayuno)\s+(?:r[áa]pid[oa]|f[áa]cil|simple)/i,
  /\b(?:r[áa]pid[oa]|f[áa]cil)\s+(?:comida|plato|cena)/i,
  /\bcocina(?:me)?\s+(?:algo|una?\s+(?:comida|plato))/i,
  /\bquiero\s+(?:una?\s+)?(?:receta|comida|plato)/i,
  /\bay[úu]dame\s+a\s+(?:hacer|cocinar|preparar)/i,
  /\bprep[áa]rame\s+(?:algo|una?\s+(?:receta|comida))/i,
];

const RECIPE_INTENT_PATTERNS = [
  ...ENGLISH_RECIPE_PATTERNS,
  ...SPANISH_RECIPE_PATTERNS,
];

/**
 * Detect if user message has high recipe generation intent.
 * Returns true when we should force tool usage to avoid chat-only responses.
 */
export function hasHighRecipeIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return RECIPE_INTENT_PATTERNS.some((pattern) => pattern.test(lowerMessage));
}

