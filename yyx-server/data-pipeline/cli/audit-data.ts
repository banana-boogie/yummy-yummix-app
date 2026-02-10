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

interface AuditEntity {
  id: string;
  name_en: string;
  name_es: string;
  picture_url?: string;
}

function auditEntities(
  entities: AuditEntity[],
  type: AuditIssue['type'],
  extraChecks?: (entity: AuditEntity) => AuditIssue[],
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const entity of entities) {
    if (!entity.picture_url) {
      issues.push({
        type,
        id: entity.id,
        name: entity.name_en || entity.name_es,
        issue: 'missing_image',
      });
    }
    if (!entity.name_en) {
      issues.push({
        type,
        id: entity.id,
        name: entity.name_es || '(unknown)',
        issue: 'missing_english_name',
      });
    }
    if (!entity.name_es) {
      issues.push({
        type,
        id: entity.id,
        name: entity.name_en || '(unknown)',
        issue: 'missing_spanish_name',
      });
    }
    if (extraChecks) {
      issues.push(...extraChecks(entity));
    }
  }
  return issues;
}

async function main() {
  logger.section(`Data Audit (${env})`);

  const [recipes, ingredients, usefulItems] = await Promise.all([
    db.fetchAllRecipes(config.supabase),
    db.fetchAllIngredients(config.supabase),
    db.fetchAllUsefulItems(config.supabase),
  ]);

  const issues: AuditIssue[] = [];

  logger.info(`Auditing ${recipes.length} recipes...`);
  issues.push(...auditEntities(recipes, 'recipe'));

  logger.info(`Auditing ${ingredients.length} ingredients...`);
  issues.push(...auditEntities(ingredients, 'ingredient', (ing) => {
    const facts = (ing as typeof ingredients[number]).nutritional_facts;
    const hasNutrition = facts &&
      typeof facts === 'object' &&
      Object.keys(facts).length > 0 &&
      'per_100g' in facts;
    if (!hasNutrition) {
      return [{
        type: 'ingredient',
        id: ing.id,
        name: ing.name_en || ing.name_es,
        issue: 'missing_nutrition',
      }];
    }
    return [];
  }));

  logger.info(`Auditing ${usefulItems.length} useful items...`);
  issues.push(...auditEntities(usefulItems, 'useful_item'));

  // ─── Group and Report ──────────────────────────────────
  const byIssue: Record<string, AuditIssue[]> = {};
  for (const issue of issues) {
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
