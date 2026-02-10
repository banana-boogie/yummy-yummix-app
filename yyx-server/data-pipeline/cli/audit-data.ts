#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env
/**
 * Audit Database for Missing Data
 *
 * Scans recipes, ingredients, and useful items for:
 *   - Missing images
 *   - Missing nutritional facts (ingredients)
 *   - Missing translations (EN or ES)
 *
 * Usage:
 *   deno task pipeline:audit --local
 *   deno task pipeline:audit --production --output ./my-report.json
 */

import { createPipelineConfig, parseEnvironment, parseFlag } from '../lib/config.ts';
import { Logger } from '../lib/logger.ts';
import * as db from '../lib/db.ts';

const logger = new Logger('audit');
const env = parseEnvironment(Deno.args);
const config = createPipelineConfig(env);

const outputPath = parseFlag(Deno.args, '--output') ||
  new URL('../audit-report.json', import.meta.url).pathname;

interface AuditIssue {
  type: 'recipe' | 'ingredient' | 'useful_item';
  id: string;
  name: string;
  issue: string;
}

async function main() {
  logger.section(`Data Audit (${env})`);

  const [recipes, ingredients, usefulItems] = await Promise.all([
    db.fetchAllRecipes(config.supabase),
    db.fetchAllIngredients(config.supabase),
    db.fetchAllUsefulItems(config.supabase),
  ]);

  const issues: AuditIssue[] = [];

  // ─── Audit Recipes ─────────────────────────────────────
  logger.info(`Auditing ${recipes.length} recipes...`);
  for (const recipe of recipes) {
    if (!recipe.picture_url) {
      issues.push({
        type: 'recipe',
        id: recipe.id,
        name: recipe.name_en || recipe.name_es,
        issue: 'missing_image',
      });
    }
    if (!recipe.name_en) {
      issues.push({
        type: 'recipe',
        id: recipe.id,
        name: recipe.name_es || '(unknown)',
        issue: 'missing_english_name',
      });
    }
    if (!recipe.name_es) {
      issues.push({
        type: 'recipe',
        id: recipe.id,
        name: recipe.name_en || '(unknown)',
        issue: 'missing_spanish_name',
      });
    }
  }

  // ─── Audit Ingredients ─────────────────────────────────
  logger.info(`Auditing ${ingredients.length} ingredients...`);
  for (const ing of ingredients) {
    if (!ing.picture_url) {
      issues.push({
        type: 'ingredient',
        id: ing.id,
        name: ing.name_en || ing.name_es,
        issue: 'missing_image',
      });
    }
    const hasNutrition = ing.nutritional_facts &&
      typeof ing.nutritional_facts === 'object' &&
      Object.keys(ing.nutritional_facts).length > 0 &&
      'per_100g' in ing.nutritional_facts;
    if (!hasNutrition) {
      issues.push({
        type: 'ingredient',
        id: ing.id,
        name: ing.name_en || ing.name_es,
        issue: 'missing_nutrition',
      });
    }
    if (!ing.name_en) {
      issues.push({
        type: 'ingredient',
        id: ing.id,
        name: ing.name_es || '(unknown)',
        issue: 'missing_english_name',
      });
    }
    if (!ing.name_es) {
      issues.push({
        type: 'ingredient',
        id: ing.id,
        name: ing.name_en || '(unknown)',
        issue: 'missing_spanish_name',
      });
    }
  }

  // ─── Audit Useful Items ────────────────────────────────
  logger.info(`Auditing ${usefulItems.length} useful items...`);
  for (const item of usefulItems) {
    if (!item.picture_url) {
      issues.push({
        type: 'useful_item',
        id: item.id,
        name: item.name_en || item.name_es,
        issue: 'missing_image',
      });
    }
    if (!item.name_en) {
      issues.push({
        type: 'useful_item',
        id: item.id,
        name: item.name_es || '(unknown)',
        issue: 'missing_english_name',
      });
    }
    if (!item.name_es) {
      issues.push({
        type: 'useful_item',
        id: item.id,
        name: item.name_en || '(unknown)',
        issue: 'missing_spanish_name',
      });
    }
  }

  // ─── Group and Report ──────────────────────────────────
  const byType: Record<string, AuditIssue[]> = {};
  const byIssue: Record<string, AuditIssue[]> = {};
  for (const issue of issues) {
    (byType[issue.type] ??= []).push(issue);
    (byIssue[issue.issue] ??= []).push(issue);
  }

  // Summary
  logger.summary({
    'Total recipes': recipes.length,
    'Total ingredients': ingredients.length,
    'Total useful items': usefulItems.length,
    'Total issues found': issues.length,
    ...Object.fromEntries(
      Object.entries(byIssue).map(([issue, items]) => [issue, items.length]),
    ),
  });

  // Write detailed report
  const report = {
    generatedAt: new Date().toISOString(),
    environment: env,
    totals: {
      recipes: recipes.length,
      ingredients: ingredients.length,
      usefulItems: usefulItems.length,
      issues: issues.length,
    },
    issuesByType: byIssue,
    allIssues: issues,
  };

  Deno.writeTextFileSync(outputPath, JSON.stringify(report, null, 2));
  logger.success(`Audit report written to: ${outputPath}`);
}

main().catch((error) => {
  logger.error('Fatal error', error);
  Deno.exit(1);
});
