/**
 * Shared Pipeline Utilities
 */

/** Promise-based delay */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Strip markdown code fences before JSON.parse (LLM responses often wrap JSON in ```json ... ```) */
export function parseJsonFromLLM(content: string): unknown {
  const stripped = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  return JSON.parse(stripped);
}
