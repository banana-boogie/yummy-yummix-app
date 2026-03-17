/**
 * Import Helpers
 *
 * Pure functions extracted from import-recipes.ts for testability.
 */

import type { ParsedRecipeData } from './recipe-parser.ts';
import type { RecipeStepInsert } from './db.ts';

/**
 * Returns true if the markdown file has actual recipe content
 * (at least one ingredient line). Stubs have empty sections.
 */
export function hasRecipeContent(content: string): boolean {
  const lines = content.split('\n');
  let inIngredientes = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '### Ingredientes') {
      inIngredientes = true;
      continue;
    }
    if (inIngredientes) {
      if (trimmed.startsWith('#')) break; // Hit next section — nothing found
      if (trimmed.startsWith('-') && trimmed.length > 2) return true;
    }
  }
  return false;
}

/**
 * Build recipe steps with Thermomix parameters.
 * Re-numbers steps sequentially (1, 2, 3...) to avoid duplicate order values
 * when recipes have multiple sections (e.g., meatballs steps 1-3 then sauce steps 1-4).
 */
export function buildRecipeSteps(
  recipeId: string,
  parsed: ParsedRecipeData,
): RecipeStepInsert[] {
  return parsed.steps.map((step, index) => {
    let speed: number | string | null = null;
    let speedStart: number | string | null = null;
    let speedEnd: number | string | null = null;

    if (step.thermomixSpeed) {
      if (step.thermomixSpeed.type === 'single') {
        speed = step.thermomixSpeed.value;
      } else if (step.thermomixSpeed.type === 'range') {
        speedStart = step.thermomixSpeed.start;
        speedEnd = step.thermomixSpeed.end;
      }
    }

    return {
      recipe_id: recipeId,
      order: index + 1, // Sequential numbering to avoid duplicates across sections
      instruction_en: step.instructionEn,
      instruction_es: step.instructionEs,
      thermomix_time: step.thermomixTime != null ? Math.max(Math.round(step.thermomixTime), 1) : null,
      thermomix_speed: speed,
      thermomix_speed_start: speedStart,
      thermomix_speed_end: speedEnd,
      thermomix_temperature: step.thermomixTemperature,
      thermomix_temperature_unit: step.thermomixTemperatureUnit,
      thermomix_is_blade_reversed: step.thermomixIsBladeReversed,
      recipe_section_en: step.recipeSectionEn || 'Main',
      recipe_section_es: step.recipeSectionEs || 'Principal',
      tip_en: step.tipEn || '',
      tip_es: step.tipEs || '',
    };
  });
}
