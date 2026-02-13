import { Recipe, RecipeIngredient, MeasurementUnit, RecipeTag, RecipeStep, RecipeUsefulItem } from '@/types/recipe.types';
import { ThermomixSettings, ThermomixSpeed, ThermomixTemperature } from '@/types/thermomix.types';
import { RawRecipeIngredient, RawMeasurementUnit, RawRecipeTag, RawRecipeStep, RawRecipe, RawRecipeUsefulItem } from '@/types/recipe.api.types';
import i18n from '@/i18n';
import { formatMeasurement } from '@/utils/recipes/measurements';
import { formatInstruction, convertTemperature } from '@/utils/thermomix/formatters';

const getLangSuffix = () => `${i18n.locale}`;

export function createRecipeTransformer(measurementSystem: 'metric' | 'imperial') {
  class RecipeTransformer {
    static transform(raw: RawRecipe): Recipe | null {
      const lang = getLangSuffix();
      return {
        id: raw.id,
        name: raw[`name_${lang}`],
        pictureUrl: raw.image_url,
        difficulty: raw.difficulty,
        prepTime: raw.prep_time,
        totalTime: raw.total_time,
        portions: raw.portions,
        ingredients: (raw.ingredients?.map(i => IngredientTransformer.transform(i, measurementSystem))
          .filter((i): i is RecipeIngredient => i !== null)
          .sort((a, b) => a.displayOrder - b.displayOrder)) || [],
        tags: this.transformTags(raw.tags, lang),
        isPublished: raw.is_published,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        steps: this.transformSteps(raw.steps, lang, measurementSystem),
        tipsAndTricks: raw[`tips_and_tricks_${lang}`],
        usefulItems: this.transformUsefulItems(raw.useful_items, lang),
        // Rating fields
        averageRating: raw.average_rating ?? null,
        ratingCount: raw.rating_count ?? 0,
      };
    }

    private static transformTags(tags: RawRecipeTag[] | undefined, lang: string): RecipeTag[] {
      if (!tags) return [];

      return tags
        .filter(t => t?.recipe_tags && t.recipe_tags.id)
        .map(t => ({
          id: t.recipe_tags.id,
          name: t.recipe_tags[`name_${lang}` as 'name_en' | 'name_es'] ?? '',
          categories: t.recipe_tags.categories
        }));
    }

    private static transformSteps(
      rawRecipeSteps: RawRecipeStep[] | undefined,
      lang: string,
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
            isBladeReversed: recipeStep.thermomix_is_blade_reversed || null
          };
        }

        const instruction = recipeStep[`instruction_${lang}` as 'instruction_en' | 'instruction_es'];
        return {
          id: recipeStep.id,
          order: recipeStep.order,
          instruction: formatInstruction(instruction, thermomix, measurementSystem),
          recipeSection: recipeStep[`recipe_section_${lang}` as 'recipe_section_en' | 'recipe_section_es'],
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

    private static transformUsefulItems(rawUsefulItems: RawRecipeUsefulItem[] | undefined, lang: string): RecipeUsefulItem[] {
      if (!rawUsefulItems) return [];

      return rawUsefulItems.map(item => ({
        id: item.id,
        name: item.useful_item[`name_${lang}` as 'name_en' | 'name_es'] ?? '',
        pictureUrl: item.useful_item.image_url,
        displayOrder: item.display_order,
        notes: item[`notes_${lang}` as 'notes_en' | 'notes_es'] ?? ''
      }));
    }
  }

  class IngredientTransformer {
    static transform(raw: RawRecipeIngredient, measurementSystem: 'metric' | 'imperial'): RecipeIngredient | null {
      if (!raw?.ingredient) return null;

      const lang = getLangSuffix();

      const measurementUnit = raw.measurement_unit ?
        MeasurementUnitTransformer.transform(raw.measurement_unit, lang) : undefined;

      const formattedMeasurements = measurementUnit ?
        formatMeasurement(raw.quantity, measurementUnit, measurementSystem) :
        { quantity: raw.quantity.toString(), unit: '' };

      return {
        id: raw.ingredient.id,
        name: raw.ingredient[`name_${lang}` as 'name_en' | 'name_es'] ?? '',
        pluralName: raw.ingredient[`plural_name_${lang}` as 'plural_name_en' | 'plural_name_es'] ?? '',
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
        notes: raw[`notes_${lang}` as 'notes_en' | 'notes_es'] ?? '',
        displayOrder: raw.display_order,
        optional: raw.optional,
        recipeSection: raw[`recipe_section_${lang}` as 'recipe_section_en' | 'recipe_section_es'] ?? '',
      };
    }
  }

  class MeasurementUnitTransformer {
    static transform(raw: RawMeasurementUnit, lang: string): MeasurementUnit {
      return {
        id: raw.id,
        type: raw.type,
        system: raw.system,
        name: raw[`name_${lang}` as 'name_en' | 'name_es'] ?? '',
        symbol: raw[`symbol_${lang}` as 'symbol_en' | 'symbol_es'] ?? '',
        symbolPlural: raw[`symbol_${lang}_plural` as 'symbol_en_plural' | 'symbol_es_plural'] ?? '',
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
