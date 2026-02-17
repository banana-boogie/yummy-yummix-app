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

// ============================================================
// Modification Detection (regex heuristic, replaces LLM call)
// ============================================================

export interface ModificationResult {
  isModification: boolean;
  modifications: string;
}

// Removal patterns — keep these specific to avoid conversational false positives.
const REMOVAL_SPECIFIC = [
  // EN specific
  /\b(?:remove|without|skip|omit|drop|leave\s+out|hold\s+the|take\s+out|get\s+rid\s+of)\s+(?:the\s+)?(.+)/i,
  /\bi\s+(?:don't|dont|do\s+not)\s+(?:like|want|eat)\s+(.+)/i,
  /\bi\s+(?:can't|cant|cannot)\s+(?:eat|have)\s+(.+)/i,
  /\bi(?:'m|\s+am)\s+(?:allergic|intolerant)\s+to\s+(.+)/i,
  // ES specific
  /\bno\s+(?:pongas|le\s+pongas|agregues|a[ñn]adas|uses|quiero)\s+(?:el|la|los|las)?\s*(.+)/i,
  /\bno\s+me\s+(?:gusta|gustan)\s+(?:el|la|los|las)?\s*(.+)/i,
  /\bsoy\s+al[ée]rgic[oa]\s+(?:a\s+las|a\s+los|a\s+la|al|a)\s+(.+)/i,
  /\b(?:quita|quitale|elimina|saca)\s+(?:el|la|los|las)?\s*(.+)/i,
  /\bsin\s+(?:el|la|los|las)?\s*(.+)/i,
  // Bare "No [ingredient]" — reject conversational phrases ("No thanks", "No, ...")
  // Must be last so ES-specific patterns (no pongas, no me gusta) match first.
  /^no\s+(?!thanks|thank|gracias|no|,|\.)\s*(?:the\s+)?(.+)/i,
];

// Adjustment patterns (EN) — "more/less" only at sentence start to avoid "tell me more about"
const ADJUSTMENT_EN = [
  /\bmake\s+it\s+(more\s+\w+|less\s+\w+|\w+(?:er|ier))/i,
  /^(more|less)\s+(\w+)/i,
  /\b(increase|decrease|reduce|lower|raise)\s+(?:the\s+)?(.+)/i,
  /\btoo\s+(\w+)/i,
  /\bnot\s+(\w+)\s+enough/i,
];

// Adjustment patterns (ES)
const ADJUSTMENT_ES = [
  /\bm[áa]s\s+(\w+)/i,
  /\bmenos\s+(\w+)/i,
  /\bhazlo?\s+m[áa]s\s+(\w+)/i,
  /\bque\s+(?:sea|quede)\s+m[áa]s\s+(\w+)/i,
  /\bmuy\s+(\w+)/i,
  /\bdemasiado\s+(\w+)/i,
];

// Substitution patterns (EN)
const SUBSTITUTION_EN = [
  /\b(?:swap|replace|substitute|switch|change|use)\s+(?:the\s+)?(.+?)\s+(?:for|with|instead\s+of|to)\s+(.+)/i,
  /\binstead\s+of\s+(.+?)(?:,?\s+use|\s+put)\s+(.+)/i,
];

// Substitution patterns (ES)
const SUBSTITUTION_ES = [
  /\b(?:cambia|reemplaza|sustituye|pon)\s+(?:el|la|los|las)?\s*(.+?)\s+(?:por|con)\s+(.+)/i,
  /\ben\s+(?:vez|lugar)\s+de\s+(.+?)(?:,?\s+(?:usa|pon|ponle))\s+(.+)/i,
];

// Addition patterns (EN)
const ADDITION_EN = [
  /\b(?:add|include|put\s+in|throw\s+in)\s+(?:some\s+)?(.+)/i,
  /\bcan\s+(?:you|we)\s+add\s+(.+)/i,
];

// Addition patterns (ES)
const ADDITION_ES = [
  /\b(?:agrega|a[ñn]ade|ponle|a[ñn][áa]dele|mete|incluye)\s+(.+)/i,
  /\b(?:puedes|podr[íi]as)\s+(?:agregar|a[ñn]adir|ponerle)\s+(.+)/i,
];

/**
 * Detect recipe modification intent using regex heuristics.
 * Replaces the previous LLM-based approach (~1.5s → <5ms).
 */
export function detectModificationHeuristic(
  message: string,
): ModificationResult {
  const trimmed = message.trim();
  if (!trimmed) return { isModification: false, modifications: "" };

  // Try removal patterns
  for (const pattern of REMOVAL_SPECIFIC) {
    const match = trimmed.match(pattern);
    if (match) {
      const target = (match[2] || match[1]).trim().replace(/[?.!,]+$/, "");
      return { isModification: true, modifications: `remove ${target}` };
    }
  }

  // Try substitution patterns (before others, since "change X for Y" is substitution)
  for (const pattern of [...SUBSTITUTION_EN, ...SUBSTITUTION_ES]) {
    const match = trimmed.match(pattern);
    if (match) {
      const from = match[1].trim().replace(/[?.!,]+$/, "");
      const to = match[2].trim().replace(/[?.!,]+$/, "");
      return {
        isModification: true,
        modifications: `replace ${from} with ${to}`,
      };
    }
  }

  // Try addition patterns (before adjustment, since "ponle más ajo" is addition, not adjustment)
  for (const pattern of [...ADDITION_EN, ...ADDITION_ES]) {
    const match = trimmed.match(pattern);
    if (match) {
      const ingredient = match[1].trim().replace(/[?.!,]+$/, "");
      return { isModification: true, modifications: `add ${ingredient}` };
    }
  }

  // Try adjustment patterns
  for (const pattern of [...ADJUSTMENT_EN, ...ADJUSTMENT_ES]) {
    const match = trimmed.match(pattern);
    if (match) {
      const descriptor = (match[2] || match[1]).trim().replace(/[?.!,]+$/, "");
      return {
        isModification: true,
        modifications: `adjust ${descriptor}`,
      };
    }
  }

  return { isModification: false, modifications: "" };
}
