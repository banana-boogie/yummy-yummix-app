/**
 * Recipe Metadata YAML Schema
 *
 * Schema-validates the YAML files at data-pipeline/data/recipe-metadata/<slug>.yaml.
 * On validation failure, errors carry source line/column from the YAML so the CLI
 * can point at the exact offending line.
 *
 * Mirrors the contract documented in
 * product-kitchen/repeat-what-works/plans/12-recipe-metadata-pipeline.md
 * and yyx-app/types/recipe.admin.types.ts.
 */

import { z } from 'zod';
import { LineCounter, parseDocument, type Document, type Node } from 'yaml';

// ============================================================
// Enum sources of truth
//
// Keep these in sync with:
//   - migration 20260410000001_add_meal_plans.sql (planner_role, cooking_level)
//   - migration 20260415120000_recipe_role_model_extension.sql (alternate_planner_roles, meal_components)
//   - migration 20260423190515_add_main_to_pairing_roles.sql (pairing_role)
//   - tag-system-rebuild.md (tag categories)
//   - yyx-app/types/thermomix.types.ts (thermomix.*)
// ============================================================

export const PLANNER_ROLES = [
  'main',
  'side',
  'snack',
  'dessert',
  'beverage',
  'condiment',
  'pantry',
] as const;

// alternate_planner_roles excludes 'pantry' (mutually exclusive with scheduling).
export const ALTERNATE_PLANNER_ROLES = [
  'main',
  'side',
  'snack',
  'dessert',
  'beverage',
  'condiment',
] as const;

export const MEAL_COMPONENTS = ['protein', 'carb', 'veg'] as const;

export const COOKING_LEVELS = ['beginner', 'intermediate', 'experienced'] as const;

export const PAIRING_ROLES = [
  'main',
  'side',
  'base',
  'veg',
  'dessert',
  'beverage',
  'condiment',
  'leftover_transform',
] as const;

// Tag categories — must mirror the DB enum public.recipe_tag_category. Track H
// rebuild expanded this from 5 to 7 categories.
export const TAG_CATEGORIES = [
  'cuisine',
  'meal_type',
  'diet',
  'dish_type',
  'primary_ingredient',
  'occasion',
  'practical',
] as const;

// Thermomix temperature unit: DB column stores 'C' | 'F' | NULL.
export const THERMOMIX_TEMPERATURE_UNITS = ['C', 'F'] as const;

// Special temperature literal allowed alongside numeric values.
export const VAROMA = 'Varoma';

// Valid speed values — must match the public.thermomix_speed_type enum
// exactly. Source of truth is the DB enum, NOT yyx-app/types/thermomix.types.ts
// (the app types include speeds the DB enum does not currently store, e.g.
// future TM7-extended values). The RPC casts to thermomix_speed_type, so any
// value missing from this list would crash the apply with an enum cast error.
// Schema-level rejection produces a line-aware error instead.
//
// To extend: first add the value to the DB enum via a migration, then add it
// here. Keep these two in lockstep.
export const VALID_SPEED_NUMBERS = [
  0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5,
  5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10,
] as const;

// Valid temperature values — must match the public.thermomix_temperature_type
// enum exactly. Same rule as VALID_SPEED_NUMBERS: the DB enum is the source of
// truth.
//
// Order intentionally mirrors enumsortorder, NOT numeric order. Postgres
// `ALTER TYPE ... ADD VALUE` without BEFORE/AFTER appends the new label after
// every existing label, so the TM7-extended values from migration
// 20260428181507_thermomix_temperature_tm7_extended.sql land at the tail of
// the enum even though they are numerically interleaved with the originals
// (Varoma lives between 120 and 130 in the original CREATE TYPE and is
// expressed separately as the VAROMA literal). Set-membership validation is
// order-insensitive so this only matters to humans reading the list against
// `\dT+` output.
export const VALID_TEMPERATURE_NUMBERS = [
  // Original CREATE TYPE values, in enumsortorder:
  37, 40, 45, 50, 55, 60, 65, 70, 75, 80,
  85, 90, 95, 98, 100, 105, 110, 115, 120,
  // (Varoma sorts here — see VAROMA above.)
  130, 140, 150, 160,
  170, 175, 185, 195, 200, 205,
  212, 220, 230, 240, 250,
  // TM7-extended values, appended in migration order:
  125, 135, 145, 155,
  257, 266, 275, 284, 293, 302, 311, 320,
] as const;

const VALID_SPEED_SET: ReadonlySet<number | string> = new Set([
  ...VALID_SPEED_NUMBERS,
  'spoon',
]);
const VALID_TEMPERATURE_SET: ReadonlySet<number | string> = new Set([
  ...VALID_TEMPERATURE_NUMBERS,
  VAROMA,
]);

// Speed: a fixed numeric step or the literal 'spoon'.
const speedValueSchema = z
  .union([z.number(), z.literal('spoon')])
  .refine(
    (v) => VALID_SPEED_SET.has(v),
    (v) => ({
      message: `invalid thermomix_speed value (${JSON.stringify(v)}); ` +
        `must be one of: 0.5, 1, 1.5 ... 10 (in 0.5 increments) or 'spoon'`,
    }),
  );

// Temperature value: a fixed numeric step or 'Varoma'.
const temperatureValueSchema = z
  .union([z.number(), z.literal(VAROMA)])
  .refine(
    (v) => VALID_TEMPERATURE_SET.has(v),
    (v) => ({
      message: `invalid thermomix_temperature value (${JSON.stringify(v)}); ` +
        `must be a value from the public.thermomix_temperature_type enum or 'Varoma'`,
    }),
  );

// Slug: lowercase snake_case, what Track H uses.
const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9_]*$/, 'must be lower_snake_case');

// Locale: short form preferred ('en', 'es'); allow regional 'es-MX' too.
const localeSchema = z
  .string()
  .min(2)
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'expected locale like "en", "es", or "es-MX"');

const uuidSchema = z.string().uuid();
const isoTimestampSchema = z
  .string()
  .min(1)
  .refine((s) => !Number.isNaN(Date.parse(s)), 'expected ISO 8601 timestamp');

// ============================================================
// Section schemas
// ============================================================

const recipeMatchSchema = z.object({
  id: uuidSchema,
  name_en: z.string().min(1),
  expected_recipe_updated_at: isoTimestampSchema,
}).strict();

const reviewSchema = z.object({
  reviewed_by_label: z.string().min(1),
  reviewed_at: isoTimestampSchema,
}).strict();

const plannerSchema = z.object({
  role: z.enum(PLANNER_ROLES).optional(),
  alternate_planner_roles: z.array(z.enum(ALTERNATE_PLANNER_ROLES)).optional(),
  meal_components: z.array(z.enum(MEAL_COMPONENTS)).optional(),
  is_complete_meal: z.boolean().optional(),
  equipment_tags: z.array(z.string().min(1)).optional(),
  cooking_level: z.enum(COOKING_LEVELS).optional(),
  leftovers_friendly: z.boolean().optional(),
  batch_friendly: z.boolean().optional(),
  max_household_size_supported: z.number().int().positive().optional(),
  is_published: z.boolean().optional(),
}).strict();

const timingsSchema = z.object({
  prep_time: z.number().int().nonnegative().optional(),
  total_time: z.number().int().nonnegative().optional(),
  portions: z.number().int().positive().optional(),
}).strict();

const tagsSchema = z.object({
  cuisine: z.array(slugSchema).optional(),
  meal_type: z.array(slugSchema).optional(),
  diet: z.array(slugSchema).optional(),
  dish_type: z.array(slugSchema).optional(),
  primary_ingredient: z.array(slugSchema).optional(),
  occasion: z.array(slugSchema).optional(),
  practical: z.array(slugSchema).optional(),
}).strict();

// Localized text sections (description, tips_and_tricks, scaling_notes) must
// supply BOTH `en` and `es` together. Per the project's locale rules there is
// no cross-language fallback (es and en are independent user groups), so
// updating one without the other silently drifts the locales apart and ships
// stale content to half the audience. The schema enforces lockstep at parse
// time.
const localizedTextSchema = z
  .object({
    en: z.string().optional(),
    es: z.string().optional(),
  })
  .strict()
  .refine(
    (v) => v.en !== undefined && v.es !== undefined,
    'localized text section must include both `en` and `es` (no cross-language drift)',
  );

const localizedNonEmptySchema = z
  .object({
    en: z.string().min(1).optional(),
    es: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (v) => v.en !== undefined && v.es !== undefined,
    'name override section must include both `en` and `es` (no cross-language drift)',
  );

// Match keys for child rows. Each table picks its preferred key set; pure name
// matching is intentionally absent — it produces silent drift on re-run.
const ingredientMatchSchema = z
  .object({
    existing_id: uuidSchema.optional(),
    ingredient_slug: slugSchema.optional(),
    display_order: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.existing_id !== undefined ||
      (v.ingredient_slug !== undefined && v.display_order !== undefined),
    'match requires either existing_id, or both ingredient_slug + display_order',
  );

const ingredientUpdateSchema = z.object({
  match: ingredientMatchSchema,
  unit: z.string().min(1).optional(),
  quantity: z.number().nonnegative().optional(),
  notes_en: z.string().optional(),
  notes_es: z.string().optional(),
  optional: z.boolean().optional(),
  section_en: z.string().optional(),
  section_es: z.string().optional(),
}).strict();

const ingredientAddSchema = z.object({
  ingredient_slug: slugSchema,
  quantity: z.number().nonnegative(),
  unit: z.string().min(1).nullable().optional(),
  display_order: z.number().int().nonnegative(),
  optional: z.boolean().optional(),
  section_en: z.string().optional(),
  section_es: z.string().optional(),
  notes_en: z.string().optional(),
  notes_es: z.string().optional(),
}).strict();

const ingredientRemoveSchema = z.object({
  match: ingredientMatchSchema,
}).strict();

// Kitchen tools — declarative set: full desired list, applier diffs.
// Match key resolution by name_en happens at apply time.
const kitchenToolEntrySchema = z.object({
  name_en: z.string().min(1),
  notes_en: z.string().optional(),
  notes_es: z.string().optional(),
}).strict();

const kitchenToolsSchema = z.object({
  set: z.array(kitchenToolEntrySchema),
}).strict();

const pairingEntrySchema = z.object({
  target_id: uuidSchema,
  target_name_en: z.string().min(1).optional(),
  role: z.enum(PAIRING_ROLES),
  reason: z.string().optional(),
}).strict();

const pairingsSchema = z.object({
  set: z.array(pairingEntrySchema),
}).strict();

const stepMatchSchema = z
  .object({
    step_id: uuidSchema.optional(),
    order: z.number().int().positive().optional(),
  })
  .strict()
  .refine(
    (v) => v.step_id !== undefined || v.order !== undefined,
    'match requires step_id or order',
  );

// Speed override — exactly one of single (`thermomix_speed`) or range
// (`thermomix_speed_range`) may be set; both null/absent means clear.
const stepOverrideSchema = z
  .object({
    match: stepMatchSchema,
    thermomix_time: z.number().int().positive().nullable().optional(),
    thermomix_speed: speedValueSchema.nullable().optional(),
    thermomix_speed_range: z
      .object({
        start: speedValueSchema,
        end: speedValueSchema,
      })
      .strict()
      .nullable()
      .optional(),
    thermomix_temperature: temperatureValueSchema.nullable().optional(),
    thermomix_temperature_unit: z.enum(THERMOMIX_TEMPERATURE_UNITS).nullable().optional(),
    thermomix_mode: z.string().nullable().optional(),
    thermomix_blade_reverse: z.boolean().nullable().optional(),
    non_thermomix_timer_seconds: z.number().int().positive().nullable().optional(),
  })
  .strict()
  .refine(
    (v) =>
      !(v.thermomix_speed !== undefined &&
        v.thermomix_speed !== null &&
        v.thermomix_speed_range !== undefined &&
        v.thermomix_speed_range !== null),
    'thermomix_speed and thermomix_speed_range are mutually exclusive',
  );

const cleanupSchema = z.object({
  delete_locales: z.array(localeSchema),
}).strict();

// requires_authoring is YAML-only triage — not persisted to the DB.
const requiresAuthoringSchema = z.object({
  reasons: z.array(z.string().min(1)),
  notes: z.string().optional(),
}).strict();

// ============================================================
// Top-level schema
// ============================================================

export const recipeMetadataSchema = z.object({
  recipe_match: recipeMatchSchema,
  review: reviewSchema,
  planner: plannerSchema.optional(),
  timings: timingsSchema.optional(),
  tags: tagsSchema.optional(),
  description: localizedTextSchema.optional(),
  tips_and_tricks: localizedTextSchema.optional(),
  scaling_notes: localizedTextSchema.optional(),
  name: localizedNonEmptySchema.optional(),
  ingredient_updates: z.array(ingredientUpdateSchema).optional(),
  ingredient_adds: z.array(ingredientAddSchema).optional(),
  ingredient_removes: z.array(ingredientRemoveSchema).optional(),
  kitchen_tools: kitchenToolsSchema.optional(),
  pairings: pairingsSchema.optional(),
  step_overrides: z.array(stepOverrideSchema).optional(),
  cleanup: cleanupSchema.optional(),
  requires_authoring: requiresAuthoringSchema.optional(),
}).strict();

export type RecipeMetadata = z.infer<typeof recipeMetadataSchema>;

// ============================================================
// Parser with line-aware errors
// ============================================================

export interface RecipeMetadataIssue {
  /** Dotted path inside the YAML (e.g. "planner.cooking_level"). */
  path: string;
  message: string;
  /** 1-indexed line number, or undefined if the path could not be located. */
  line?: number;
  /** 1-indexed column number, or undefined if the path could not be located. */
  col?: number;
}

export class RecipeMetadataValidationError extends Error {
  override readonly name = 'RecipeMetadataValidationError';
  readonly issues: RecipeMetadataIssue[];
  readonly source: string;

  constructor(issues: RecipeMetadataIssue[], source: string) {
    super(formatIssues(issues));
    this.issues = issues;
    this.source = source;
  }
}

export interface ParseResult {
  data: RecipeMetadata;
  /** Non-fatal advisories from the parser (duplicate keys, anchors, etc.). */
  warnings: RecipeMetadataIssue[];
}

/**
 * Parse and validate a YAML string. Throws RecipeMetadataValidationError
 * on any structural or schema problem; the error carries line/col offsets
 * so the CLI can render `file.yaml:42:7 — message`.
 */
export function parseRecipeMetadataYaml(yamlText: string): ParseResult {
  const lineCounter = new LineCounter();
  const doc = parseDocument(yamlText, { lineCounter, prettyErrors: false });

  const yamlIssues: RecipeMetadataIssue[] = doc.errors.map((err) => ({
    path: '',
    message: `YAML parse error: ${err.message}`,
    ...resolvePos(err.pos?.[0], lineCounter),
  }));

  if (yamlIssues.length > 0) {
    throw new RecipeMetadataValidationError(yamlIssues, yamlText);
  }

  const warnings: RecipeMetadataIssue[] = doc.warnings.map((warn) => ({
    path: '',
    message: warn.message,
    ...resolvePos(warn.pos?.[0], lineCounter),
  }));

  const raw = doc.toJS({ mapAsMap: false });

  const result = recipeMetadataSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((issue) =>
      zodIssueToMetadataIssue(issue, doc, lineCounter)
    );
    throw new RecipeMetadataValidationError(issues, yamlText);
  }

  return { data: result.data, warnings };
}

function zodIssueToMetadataIssue(
  issue: z.ZodIssue,
  doc: Document,
  lineCounter: LineCounter,
): RecipeMetadataIssue {
  const path = issue.path.join('.');
  const node = locateNode(doc, issue.path);
  const offset = node && 'range' in node && node.range ? node.range[0] : undefined;
  const pos = resolvePos(offset, lineCounter);
  return {
    path,
    message: issue.message,
    ...pos,
  };
}

function locateNode(doc: Document, path: ReadonlyArray<PropertyKey>): Node | null {
  if (path.length === 0) {
    const contents = doc.contents;
    return (contents && typeof contents === 'object' && 'range' in contents)
      ? contents as Node
      : null;
  }
  const node = doc.getIn(path as readonly unknown[], true);
  if (node && typeof node === 'object' && 'range' in node) {
    return node as Node;
  }
  // Fall back to walking up the path until we find a located node.
  if (path.length > 1) {
    return locateNode(doc, path.slice(0, -1));
  }
  return null;
}

function resolvePos(
  offset: number | undefined,
  lineCounter: LineCounter,
): { line?: number; col?: number } {
  if (offset === undefined) return {};
  const lc = lineCounter.linePos(offset);
  return { line: lc.line, col: lc.col };
}

function formatIssues(issues: RecipeMetadataIssue[]): string {
  if (issues.length === 0) return 'recipe metadata YAML is invalid';
  const lines = issues.map((issue) => {
    const loc = issue.line !== undefined ? `:${issue.line}:${issue.col ?? 1}` : '';
    const where = issue.path ? ` at ${issue.path}` : '';
    return `  - ${loc}${where} — ${issue.message}`;
  });
  return `recipe metadata YAML failed validation:\n${lines.join('\n')}`;
}
