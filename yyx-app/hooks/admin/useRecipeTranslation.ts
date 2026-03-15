import { useState, useCallback } from 'react';
import { translateContent , TranslationResult } from '@/services/admin/adminTranslateService';
import logger from '@/services/logger';
import { ExtendedRecipe } from './useAdminRecipeForm';
import {
  AdminRecipeTranslation,
  AdminRecipeStepTranslation,
  AdminRecipeIngredientTranslation,
  AdminRecipeKitchenToolTranslation,
  pickTranslation,
} from '@/types/recipe.admin.types';

export type TranslationFieldStatus = 'auto' | 'edited' | 'missing';

/** Skip results that failed or returned empty fields */
function isSuccessfulResult(result: TranslationResult): boolean {
  return !result.error && Object.keys(result.fields).length > 0;
}

interface TranslationProgress {
  current: number;
  total: number;
  label: string;
}

interface UseRecipeTranslationReturn {
  translating: boolean;
  progress: TranslationProgress | null;
  error: string | null;
  failedLocales: string[];
  translateAll: (
    recipe: ExtendedRecipe,
    sourceLocale: string,
    targetLocales: string[],
  ) => Promise<ExtendedRecipe>;
}

export function useRecipeTranslation(): UseRecipeTranslationReturn {
  const [translating, setTranslating] = useState(false);
  const [progress, setProgress] = useState<TranslationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedLocales, setFailedLocales] = useState<string[]>([]);

  const translateAll = useCallback(
    async (
      recipe: ExtendedRecipe,
      sourceLocale: string,
      targetLocales: string[],
    ): Promise<ExtendedRecipe> => {
      setTranslating(true);
      setError(null);
      setFailedLocales([]);

      // Count total batches: recipe info + each step + each ingredient + each kitchen tool
      const steps = recipe.steps || [];
      const ingredients = recipe.ingredients || [];
      const kitchenTools = recipe.kitchenTools || [];
      const totalBatches =
        1 + steps.length + ingredients.length + kitchenTools.length;
      let completed = 0;

      const tick = (label: string) => {
        completed++;
        setProgress({ current: completed, total: totalBatches, label });
      };

      const failed = new Set<string>();

      /** Filter successful results and track failures */
      const filterResults = (results: TranslationResult[]) => {
        for (const r of results) {
          if (!isSuccessfulResult(r)) failed.add(r.targetLocale);
        }
        return results.filter(isSuccessfulResult);
      };

      try {
        let updatedRecipe = { ...recipe };

        // 1. Translate recipe info (name, tipsAndTricks)
        setProgress({ current: 0, total: totalBatches, label: 'Recipe info' });
        const recipeSource = pickTranslation(
          recipe.translations,
          sourceLocale,
        ) as AdminRecipeTranslation | undefined;
        if (recipeSource?.name) {
          const fields: Record<string, string> = {};
          if (recipeSource.name) fields.name = recipeSource.name;
          if (recipeSource.tipsAndTricks)
            fields.tipsAndTricks = recipeSource.tipsAndTricks;

          try {
            const results = await translateContent(
              fields,
              sourceLocale,
              targetLocales,
            );
            let updated = [...(updatedRecipe.translations || [])];
            for (const result of filterResults(results)) {
              const existing = updated.find(
                (t) => t.locale === result.targetLocale,
              );
              const newFields = {
                name: result.fields.name || '',
                tipsAndTricks: result.fields.tipsAndTricks,
              };
              if (existing) {
                updated = updated.map((t) =>
                  t.locale === result.targetLocale
                    ? { ...t, ...newFields }
                    : t,
                );
              } else {
                updated.push({
                  locale: result.targetLocale,
                  ...newFields,
                } as AdminRecipeTranslation);
              }
            }
            updatedRecipe = { ...updatedRecipe, translations: updated };
          } catch (e) {
            logger.error('Failed to translate recipe info:', e);
          }
        }
        tick('Recipe info');

        // 2. Translate steps
        const updatedSteps = [...steps];
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const stepSource = pickTranslation(
            step.translations,
            sourceLocale,
          ) as AdminRecipeStepTranslation | undefined;
          if (stepSource?.instruction) {
            const fields: Record<string, string> = {};
            if (stepSource.instruction)
              fields.instruction = stepSource.instruction;
            if (stepSource.recipeSection)
              fields.recipeSection = stepSource.recipeSection;
            if (stepSource.tip) fields.tip = stepSource.tip;

            try {
              const results = await translateContent(
                fields,
                sourceLocale,
                targetLocales,
              );
              let updated = [...step.translations];
              for (const result of filterResults(results)) {
                const existing = updated.find(
                  (t) => t.locale === result.targetLocale,
                );
                const newFields: Partial<AdminRecipeStepTranslation> = {
                  instruction: result.fields.instruction || '',
                };
                if (result.fields.recipeSection)
                  newFields.recipeSection = result.fields.recipeSection;
                if (result.fields.tip) newFields.tip = result.fields.tip;

                if (existing) {
                  updated = updated.map((t) =>
                    t.locale === result.targetLocale
                      ? { ...t, ...newFields }
                      : t,
                  );
                } else {
                  updated.push({
                    locale: result.targetLocale,
                    ...newFields,
                  } as AdminRecipeStepTranslation);
                }
              }
              updatedSteps[i] = { ...step, translations: updated };
            } catch (e) {
              logger.error(`Failed to translate step ${i + 1}:`, e);
            }
          }
          tick(`Step ${i + 1}`);
        }
        updatedRecipe = { ...updatedRecipe, steps: updatedSteps };

        // 3. Translate ingredients
        const updatedIngredients = [...ingredients];
        for (let i = 0; i < ingredients.length; i++) {
          const ing = ingredients[i];
          const ingSource = pickTranslation(
            ing.translations,
            sourceLocale,
          ) as AdminRecipeIngredientTranslation | undefined;
          const hasContent =
            ingSource?.notes?.trim() ||
            ingSource?.tip?.trim() ||
            ingSource?.recipeSection?.trim();
          if (hasContent) {
            const fields: Record<string, string> = {};
            if (ingSource!.notes) fields.notes = ingSource!.notes;
            if (ingSource!.tip) fields.tip = ingSource!.tip;
            if (ingSource!.recipeSection)
              fields.recipeSection = ingSource!.recipeSection;

            try {
              const results = await translateContent(
                fields,
                sourceLocale,
                targetLocales,
              );
              let updated = [...ing.translations];
              for (const result of filterResults(results)) {
                const existing = updated.find(
                  (t) => t.locale === result.targetLocale,
                );
                const newFields: Partial<AdminRecipeIngredientTranslation> = {};
                if (result.fields.notes) newFields.notes = result.fields.notes;
                if (result.fields.tip) newFields.tip = result.fields.tip;
                if (result.fields.recipeSection)
                  newFields.recipeSection = result.fields.recipeSection;

                if (existing) {
                  updated = updated.map((t) =>
                    t.locale === result.targetLocale
                      ? { ...t, ...newFields }
                      : t,
                  );
                } else {
                  updated.push({
                    locale: result.targetLocale,
                    ...newFields,
                  } as AdminRecipeIngredientTranslation);
                }
              }
              updatedIngredients[i] = { ...ing, translations: updated };
            } catch (e) {
              logger.error(`Failed to translate ingredient ${i + 1}:`, e);
            }
          }
          tick(`Ingredient ${i + 1}`);
        }
        updatedRecipe = { ...updatedRecipe, ingredients: updatedIngredients };

        // 4. Translate kitchen tools
        const updatedKitchenTools = [...kitchenTools];
        for (let i = 0; i < kitchenTools.length; i++) {
          const item = kitchenTools[i];
          const itemSource = pickTranslation(
            item.translations,
            sourceLocale,
          ) as AdminRecipeKitchenToolTranslation | undefined;
          if (itemSource?.notes?.trim()) {
            try {
              const results = await translateContent(
                { notes: itemSource.notes },
                sourceLocale,
                targetLocales,
              );
              let updated = [...item.translations];
              for (const result of filterResults(results)) {
                const existing = updated.find(
                  (t) => t.locale === result.targetLocale,
                );
                if (existing) {
                  updated = updated.map((t) =>
                    t.locale === result.targetLocale
                      ? { ...t, notes: result.fields.notes || '' }
                      : t,
                  );
                } else {
                  updated.push({
                    locale: result.targetLocale,
                    notes: result.fields.notes || '',
                  });
                }
              }
              updatedKitchenTools[i] = { ...item, translations: updated };
            } catch (e) {
              logger.error(`Failed to translate kitchen tool ${i + 1}:`, e);
            }
          }
          tick(`Kitchen tool ${i + 1}`);
        }
        updatedRecipe = { ...updatedRecipe, kitchenTools: updatedKitchenTools };

        if (failed.size > 0) {
          setFailedLocales([...failed]);
        }

        return updatedRecipe;
      } catch (e: any) {
        setError(e.message || 'Translation failed');
        return recipe;
      } finally {
        setTranslating(false);
        setProgress(null);
      }
    },
    [],
  );

  return { translating, progress, error, failedLocales, translateAll };
}
