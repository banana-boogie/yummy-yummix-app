import { Recipe, RecipeIngredient, MeasurementUnit, RecipeTag, RecipeStep, RecipeKitchenTool } from '@/types/recipe.types';
import { ThermomixSettings, ThermomixSpeed, ThermomixTemperature } from '@/types/thermomix.types';
import {
  RawRecipeIngredient, RawMeasurementUnit, RawRecipeTag, RawRecipeStep, RawRecipe, RawRecipeKitchenTool,
} from '@/types/recipe.api.types';
import i18n from '@/i18n';
import { formatMeasurement } from '@/utils/recipes/measurements';
import { formatInstruction, convertTemperature } from '@/utils/thermomix/formatters';

/**
 * Picks the best translation from an array based on the current i18n locale.
 * Fallback chain: exact locale -> language prefix -> first available -> undefined.
 *
 * @example
 * pickTranslation(translations, 'locale') // uses i18n.locale internally
 */
export function pickTranslation<T extends Record<string, any>>(
  translations: T[] | undefined | null,
  localeKey = 'locale',
): T | undefined {
  if (!translations || translations.length === 0) return undefined;

  const currentLocale = i18n.locale; // 'en' or 'es'

  // 1. Exact match
  const exact = translations.find(t => t[localeKey] === currentLocale);
  if (exact) return exact;

  // 2. Prefix match (e.g. 'es' matches 'es-MX')
  const prefix = translations.find(t =>
    typeof t[localeKey] === 'string' && t[localeKey].startsWith(currentLocale)
  );
  if (prefix) return prefix;

  // 3. Reverse prefix (e.g. locale is 'es-MX', translation has 'es')
  const reversePrefix = translations.find(t =>
    typeof t[localeKey] === 'string' && currentLocale.startsWith(t[localeKey])
  );
  if (reversePrefix) return reversePrefix;

  // 4. Fallback to 'en' if nothing matched
  const enFallback = translations.find(t => t[localeKey] === 'en');
  if (enFallback) return enFallback;

  // 5. Last resort: first available
  return translations[0];
}

export function createRecipeTransformer(measurementSystem: 'metric' | 'imperial') {
  class RecipeTransformer {
    static transform(raw: RawRecipe): Recipe | null {
      const t = pickTranslation(raw.translations);
      return {
        id: raw.id,
        name: t?.name ?? '',
        pictureUrl: raw.image_url,
        difficulty: raw.difficulty,
        prepTime: raw.prep_time,
        totalTime: raw.total_time,
        portions: raw.portions,
        ingredients: (raw.ingredients?.map(i => IngredientTransformer.transform(i, measurementSystem))
          .filter((i): i is RecipeIngredient => i !== null)
          .sort((a, b) => a.displayOrder - b.displayOrder)) || [],
        tags: this.transformTags(raw.tags),
        isPublished: raw.is_published,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        steps: this.transformSteps(raw.steps, measurementSystem),
        tipsAndTricks: t?.tips_and_tricks ?? undefined,
        kitchenTools: this.transformKitchenTools(raw.kitchen_tools),
        averageRating: raw.average_rating ?? null,
        ratingCount: raw.rating_count ?? 0,
      };
    }

    private static transformTags(tags: RawRecipeTag[] | undefined): RecipeTag[] {
      if (!tags) return [];

      return tags
        .filter(t => t?.recipe_tags && t.recipe_tags.id)
        .map(t => {
          const translation = pickTranslation(t.recipe_tags.translations);
          return {
            id: t.recipe_tags.id,
            name: translation?.name ?? '',
            categories: t.recipe_tags.categories
          };
        });
    }

    private static transformSteps(
      rawRecipeSteps: RawRecipeStep[] | undefined,
      measurementSystem: 'metric' | 'imperial'
    ): RecipeStep[] {
      if (!rawRecipeSteps) return [];

      const transformedSteps = rawRecipeSteps.map(recipeStep => {
        const ingredients = (recipeStep.step_ingredients?.map((si, index) =>
          IngredientTransformer.transform({
            ingredient: si.ingredient,
            measurement_unit: si.measurement_unit,
            quantity: si.quantity,
            display_order: si.display_order || index,
            optional: si.optional,
          }, measurementSystem)
        ).filter((i) => i !== null) || []);

        let thermomix: ThermomixSettings | undefined;
        if (recipeStep.thermomix_time || recipeStep.thermomix_speed || recipeStep.thermomix_temperature ||
          recipeStep.thermomix_speed_start || recipeStep.thermomix_speed_end) {

          // Handle speed
          let speed: ThermomixSpeed = null;
          if (recipeStep.thermomix_speed_start && recipeStep.thermomix_speed_end) {
            speed = {
              type: 'range',
              start: recipeStep.thermomix_speed_start,
              end: recipeStep.thermomix_speed_end
            };
          } else if (recipeStep.thermomix_speed) {
            speed = {
              type: 'single',
              value: recipeStep.thermomix_speed
            };
          }

          // Handle temperature
          let temperature: ThermomixTemperature | null = null;
          if (recipeStep.thermomix_temperature) {
            temperature = convertTemperature(recipeStep.thermomix_temperature, recipeStep.thermomix_temperature_unit, measurementSystem);
          }

          thermomix = {
            time: recipeStep.thermomix_time || null,
            speed: speed,
            temperature: temperature,
            temperatureUnit: measurementSystem === 'imperial' ? 'F' : 'C',
            isBladeReversed: recipeStep.thermomix_is_blade_reversed || null,
            mode: recipeStep.thermomix_mode || null,
          };
        }

        const stepTranslation = pickTranslation(recipeStep.translations);
        const instruction = stepTranslation?.instruction ?? '';
        const tip = stepTranslation?.tip ?? null;
        return {
          id: recipeStep.id,
          order: recipeStep.order,
          instruction: formatInstruction(instruction, thermomix, measurementSystem),
          recipeSection: stepTranslation?.recipe_section ?? null,
          tip,
          timerSeconds: (recipeStep as any).timer_seconds ?? null,
          ingredients,
          thermomix
        };
      });

      // Then sort steps by order and group by section
      const groupedSteps = transformedSteps.reduce((acc, step) => {
        const sectionKey = step.recipeSection || '';
        if (!acc[sectionKey]) {
          acc[sectionKey] = {
            order: step.order, // First step's order becomes section order
            steps: []
          };
        }
        acc[sectionKey].steps.push(step);
        return acc;
      }, {} as Record<string, { order: number; steps: RecipeStep[] }>);

      // Sort sections and their steps
      return Object.entries(groupedSteps)
        .sort(([, a], [, b]) => a.order - b.order)
        .flatMap(([, { steps }]) =>
          // Sort steps within each section
          steps.sort((a, b) => a.order - b.order)
        );
    }

    private static transformKitchenTools(rawKitchenTools: RawRecipeKitchenTool[] | undefined): RecipeKitchenTool[] {
      if (!rawKitchenTools) return [];

      return rawKitchenTools.map(item => {
        const itemTranslation = pickTranslation(item.kitchen_tool.translations);
        const notesTranslation = pickTranslation(item.translations);
        return {
          id: item.id,
          name: itemTranslation?.name ?? '',
          pictureUrl: item.kitchen_tool.image_url,
          displayOrder: item.display_order,
          notes: notesTranslation?.notes ?? ''
        };
      });
    }
  }

  class IngredientTransformer {
    static transform(raw: RawRecipeIngredient, measurementSystem: 'metric' | 'imperial'): RecipeIngredient | null {
      if (!raw?.ingredient) return null;

      const ingredientTranslation = pickTranslation(raw.ingredient.translations);
      const measurementUnit = raw.measurement_unit ?
        MeasurementUnitTransformer.transform(raw.measurement_unit) : undefined;

      const formattedMeasurements = measurementUnit ?
        formatMeasurement(raw.quantity, measurementUnit, measurementSystem) :
        { quantity: raw.quantity.toString(), unit: '' };

      const recipeIngTranslation = pickTranslation(raw.translations);

      return {
        id: raw.ingredient.id,
        name: ingredientTranslation?.name ?? '',
        pluralName: ingredientTranslation?.plural_name ?? '',
        quantity: raw.quantity.toString(),
        measurementUnit: measurementUnit || {
          id: '',
          type: 'unit',
          system: 'universal',
          name: '',
          symbol: '',
          symbolPlural: ''
        },
        formattedQuantity: formattedMeasurements.quantity,
        formattedUnit: formattedMeasurements.unit,
        pictureUrl: raw.ingredient.image_url,
        notes: recipeIngTranslation?.notes ?? '',
        displayOrder: raw.display_order,
        optional: raw.optional,
        recipeSection: recipeIngTranslation?.recipe_section ?? '',
      };
    }
  }

  class MeasurementUnitTransformer {
    static transform(raw: RawMeasurementUnit): MeasurementUnit {
      const t = pickTranslation(raw.translations);
      return {
        id: raw.id,
        type: raw.type,
        system: raw.system,
        name: t?.name ?? '',
        symbol: t?.symbol ?? '',
        symbolPlural: t?.symbol_plural ?? '',
      };
    }
  }

  return {
    transformRecipe: (raw: RawRecipe): Recipe | null => {
      return RecipeTransformer.transform(raw);
    },
    transformRecipes: (rawRecipes: RawRecipe[]): Recipe[] => {
      return rawRecipes
        .map(raw => RecipeTransformer.transform(raw))
        .filter((recipe): recipe is Recipe => recipe !== null);
    }
  };
}
