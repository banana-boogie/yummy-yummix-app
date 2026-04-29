/**
 * Compute a human-readable diff between the current DB state and the desired
 * state from a recipe-metadata YAML config. Side-effect-free; consumed by
 * the apply-recipe-metadata CLI for both --dry-run output and post-apply
 * verification.
 */

import { type RecipeMetadata, TAG_CATEGORIES } from './recipe-metadata-schema.ts';
import type {
  CurrentRecipeState,
  IngredientSnapshot,
  KitchenToolSnapshot,
  PairingSnapshot,
  StepSnapshot,
} from './recipe-metadata-fetch.ts';
import { slugifyName } from './recipe-metadata-fetch.ts';

export interface DiffEntry {
  path: string;
  before: unknown;
  after: unknown;
  /**
   * Optional structured detail rendered alongside before/after for sections
   * that need a richer view (e.g. cleanup row-count breakdowns showing
   * how many recipe/step/ingredient translation rows a locale delete
   * will actually remove).
   */
  details?: Record<string, number>;
}

export interface SectionDiff {
  section: string;
  changes: DiffEntry[];
  /** Side notes (e.g. "no-op", "section absent in YAML"). */
  notes?: string[];
}

export interface RecipeMetadataDiff {
  recipe_id: string;
  recipe_name_en: string | null;
  /** True if the live row's updated_at is ahead of the YAML's expected timestamp. */
  stale_diff: boolean;
  stale_diff_detail?: { db: string; expected: string };
  sections: SectionDiff[];
  total_changes: number;
}

const PLANNER_FIELDS = [
  'role',
  'alternate_planner_roles',
  'meal_components',
  'is_complete_meal',
  'equipment_tags',
  'cooking_level',
  'leftovers_friendly',
  'batch_friendly',
  'max_household_size_supported',
  'is_published',
] as const;

const PLANNER_TO_DB: Record<string, string> = {
  role: 'planner_role',
  alternate_planner_roles: 'alternate_planner_roles',
  meal_components: 'meal_components',
  is_complete_meal: 'is_complete_meal',
  equipment_tags: 'equipment_tags',
  cooking_level: 'cooking_level',
  leftovers_friendly: 'leftovers_friendly',
  batch_friendly: 'batch_friendly',
  max_household_size_supported: 'max_household_size_supported',
  is_published: 'is_published',
};

export function computeRecipeMetadataDiff(
  desired: RecipeMetadata,
  current: CurrentRecipeState,
): RecipeMetadataDiff {
  const sections: SectionDiff[] = [];

  // -- stale-diff signal -------------------------------------
  const dbAt = new Date(current.updated_at).getTime();
  const expectedAt = new Date(desired.recipe_match.expected_recipe_updated_at).getTime();
  const stale = dbAt > expectedAt;

  // -- planner -----------------------------------------------
  if (desired.planner) {
    const changes: DiffEntry[] = [];
    const p = desired.planner as Record<string, unknown>;
    const c = current.planner as unknown as Record<string, unknown>;
    for (const key of PLANNER_FIELDS) {
      if (!(key in p)) continue;
      const desiredVal = p[key];
      if (desiredVal === undefined) continue;
      const dbCol = PLANNER_TO_DB[key];
      const currentVal = c[dbCol];
      if (!equalsLoose(currentVal, desiredVal)) {
        changes.push({ path: `planner.${key}`, before: currentVal, after: desiredVal });
      }
    }
    sections.push({ section: 'planner', changes });
  }

  // -- timings -----------------------------------------------
  if (desired.timings) {
    const changes: DiffEntry[] = [];
    for (const key of ['prep_time', 'total_time', 'portions'] as const) {
      const d = desired.timings[key];
      if (d === undefined) continue;
      const cur = current.timings[key];
      if (!equalsLoose(cur, d)) {
        changes.push({ path: `timings.${key}`, before: cur, after: d });
      }
    }
    sections.push({ section: 'timings', changes });
  }

  // -- name overrides ----------------------------------------
  if (desired.name) {
    const changes: DiffEntry[] = [];
    for (const locale of ['en', 'es'] as const) {
      const d = desired.name[locale];
      if (d === undefined) continue;
      const cur = current.translations.find((t) => t.locale === locale)?.name ?? null;
      if (cur !== d) changes.push({ path: `name.${locale}`, before: cur, after: d });
    }
    sections.push({ section: 'name', changes });
  }

  // -- description / tips_and_tricks / scaling_notes ---------
  for (const field of ['description', 'tips_and_tricks', 'scaling_notes'] as const) {
    const block = desired[field];
    if (!block) continue;
    const changes: DiffEntry[] = [];
    for (const locale of ['en', 'es'] as const) {
      const d = block[locale];
      if (d === undefined) continue;
      const cur = (current.translations.find((t) => t.locale === locale) ?? {}) as Record<
        string,
        unknown
      >;
      const curVal = (cur[field] as string | null | undefined) ?? null;
      if (curVal !== d) changes.push({ path: `${field}.${locale}`, before: curVal, after: d });
    }
    sections.push({ section: field, changes });
  }

  // -- ingredient updates / adds / removes -------------------
  if (desired.ingredient_updates) {
    const changes: DiffEntry[] = [];
    for (const upd of desired.ingredient_updates) {
      const target = matchIngredient(upd.match, current.ingredients);
      if (!target) {
        changes.push({
          path: `ingredient_updates`,
          before: upd.match,
          after: '⚠ NO MATCH IN DB — apply will raise',
        });
        continue;
      }
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (upd.unit !== undefined && (upd.unit ?? null) !== (target.measurement_unit_id ?? null)) {
        before.unit = target.measurement_unit_id;
        after.unit = upd.unit;
      }
      if (upd.quantity !== undefined && Number(upd.quantity) !== Number(target.quantity ?? 0)) {
        before.quantity = target.quantity;
        after.quantity = upd.quantity;
      }
      if (upd.optional !== undefined && upd.optional !== target.optional) {
        before.optional = target.optional;
        after.optional = upd.optional;
      }
      if (Object.keys(after).length > 0) {
        changes.push({
          path: `ingredient_updates[${target.slug}@${target.display_order}]`,
          before,
          after,
        });
      }
      // Per-locale notes / recipe_section diff. Mirrors the RPC's
      // ingredient_updates loop: each YAML field is compared against the
      // matching `recipe_ingredient_translations.{notes,recipe_section}` for
      // that locale, and an entry is emitted when they differ. Without this,
      // a YAML whose only edit is `notes_es:` produces a silent apply.
      for (const locale of ['en', 'es'] as const) {
        const desiredNotes = (upd as Record<string, unknown>)[`notes_${locale}`] as
          | string
          | undefined;
        const desiredSection = (upd as Record<string, unknown>)[`section_${locale}`] as
          | string
          | undefined;
        if (desiredNotes === undefined && desiredSection === undefined) continue;
        const cur = target.translations.find((t) => t.locale === locale);
        if (desiredNotes !== undefined) {
          const curNotes = cur?.notes ?? null;
          if (curNotes !== desiredNotes) {
            changes.push({
              path: `ingredient_updates[${target.slug}@${target.display_order}].notes_${locale}`,
              before: curNotes,
              after: desiredNotes,
            });
          }
        }
        if (desiredSection !== undefined) {
          const curSection = cur?.recipe_section ?? null;
          if (curSection !== desiredSection) {
            changes.push({
              path: `ingredient_updates[${target.slug}@${target.display_order}].section_${locale}`,
              before: curSection,
              after: desiredSection,
            });
          }
        }
      }
    }
    sections.push({ section: 'ingredient_updates', changes });
  }

  if (desired.ingredient_adds) {
    const changes: DiffEntry[] = [];
    for (const add of desired.ingredient_adds) {
      const conflict = current.ingredients.find(
        (i) => i.display_order === add.display_order && i.slug === add.ingredient_slug,
      );
      if (conflict) continue; // idempotent
      changes.push({
        path: `ingredient_adds[${add.ingredient_slug}@${add.display_order}]`,
        before: null,
        after: { quantity: add.quantity, unit: add.unit ?? null },
      });
    }
    sections.push({ section: 'ingredient_adds', changes });
  }

  if (desired.ingredient_removes) {
    const changes: DiffEntry[] = [];
    for (const rem of desired.ingredient_removes) {
      const target = matchIngredient(rem.match, current.ingredients);
      if (!target) continue;
      changes.push({
        path: `ingredient_removes[${target.slug}@${target.display_order}]`,
        before: { quantity: target.quantity, unit: target.measurement_unit_id },
        after: null,
      });
    }
    sections.push({ section: 'ingredient_removes', changes });
  }

  // -- kitchen_tools (declarative set) -----------------------
  if (desired.kitchen_tools) {
    const changes: DiffEntry[] = [];
    const desiredNames = new Set(
      desired.kitchen_tools.set.map((kt) => kt.name_en.trim().toLowerCase()),
    );
    const currentNames = new Set(
      current.kitchen_tools.map((kt) => kt.name_en.trim().toLowerCase()),
    );
    for (const kt of desired.kitchen_tools.set) {
      if (!currentNames.has(kt.name_en.trim().toLowerCase())) {
        changes.push({ path: `kitchen_tools.+`, before: null, after: kt.name_en });
      }
    }
    for (const kt of current.kitchen_tools) {
      if (!desiredNames.has(kt.name_en.trim().toLowerCase())) {
        changes.push({ path: `kitchen_tools.-`, before: kt.name_en, after: null });
      }
    }
    // Notes diff — check entries that survive
    for (const desiredKt of desired.kitchen_tools.set) {
      const cur = findKitchenTool(current.kitchen_tools, desiredKt.name_en);
      if (!cur) continue;
      for (const locale of ['en', 'es'] as const) {
        const d = (desiredKt as Record<string, unknown>)[`notes_${locale}`] as string | undefined;
        if (d === undefined) continue;
        const c = locale === 'en' ? cur.notes_en : cur.notes_es;
        if (d !== c) {
          changes.push({
            path: `kitchen_tools[${cur.name_en}].notes_${locale}`,
            before: c,
            after: d,
          });
        }
      }
    }
    sections.push({ section: 'kitchen_tools', changes });
  }

  // -- pairings (declarative set, target_id+role) ------------
  if (desired.pairings) {
    const changes: DiffEntry[] = [];
    const desiredKeys = new Set(
      desired.pairings.set.map((p) => `${p.target_id}|${p.role}`),
    );
    const currentKeys = new Set(
      current.pairings.map((p) => `${p.target_recipe_id}|${p.pairing_role}`),
    );
    for (const p of desired.pairings.set) {
      const k = `${p.target_id}|${p.role}`;
      if (!currentKeys.has(k)) {
        changes.push({
          path: `pairings.+`,
          before: null,
          after: { target: p.target_name_en ?? p.target_id, role: p.role },
        });
      }
    }
    for (const p of current.pairings) {
      const k = `${p.target_recipe_id}|${p.pairing_role}`;
      if (!desiredKeys.has(k)) {
        changes.push({
          path: `pairings.-`,
          before: { target: p.target_name_en ?? p.target_recipe_id, role: p.pairing_role },
          after: null,
        });
      }
    }
    sections.push({ section: 'pairings', changes });
  }

  // -- step_overrides (per-row, per-field) -------------------
  if (desired.step_overrides) {
    const changes: DiffEntry[] = [];
    for (const ov of desired.step_overrides) {
      const target = findStep(current.steps, ov.match);
      if (!target) {
        changes.push({
          path: `step_overrides`,
          before: ov.match,
          after: '⚠ NO MATCH IN DB — apply will raise',
        });
        continue;
      }
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      const compare = <K extends string>(yamlKey: K, dbKey: keyof StepSnapshot) => {
        const yamlVal = (ov as Record<string, unknown>)[yamlKey];
        if (yamlVal === undefined) return;
        const cur = target[dbKey];
        if (cur !== yamlVal) {
          (before as Record<string, unknown>)[yamlKey] = cur;
          (after as Record<string, unknown>)[yamlKey] = yamlVal;
        }
      };
      compare('thermomix_time', 'thermomix_time');
      compare('thermomix_speed', 'thermomix_speed');
      compare('thermomix_temperature', 'thermomix_temperature');
      compare('thermomix_temperature_unit', 'thermomix_temperature_unit');
      compare('thermomix_mode', 'thermomix_mode');
      compare('thermomix_blade_reverse', 'thermomix_is_blade_reversed');
      compare('non_thermomix_timer_seconds', 'timer_seconds');
      if (ov.thermomix_speed_range !== undefined) {
        const dStart = ov.thermomix_speed_range?.start ?? null;
        const dEnd = ov.thermomix_speed_range?.end ?? null;
        if (dStart !== target.thermomix_speed_start || dEnd !== target.thermomix_speed_end) {
          before.thermomix_speed_range = {
            start: target.thermomix_speed_start,
            end: target.thermomix_speed_end,
          };
          after.thermomix_speed_range = ov.thermomix_speed_range;
        }
      }
      if (Object.keys(after).length > 0) {
        changes.push({ path: `step_overrides[order=${target.order}]`, before, after });
      }
    }
    sections.push({ section: 'step_overrides', changes });
  }

  // -- step_text_overrides (per-row, per-locale, per-field) --
  if (desired.step_text_overrides) {
    const changes: DiffEntry[] = [];
    for (const ov of desired.step_text_overrides) {
      const target = findStep(current.steps, ov.match);
      if (!target) {
        changes.push({
          path: `step_text_overrides`,
          before: ov.match,
          after: '⚠ NO MATCH IN DB — apply will raise',
        });
        continue;
      }
      for (const locale of ['en', 'es'] as const) {
        const block = ov.translations[locale];
        if (!block) continue;
        const cur = target.translations.find((t) => t.locale === locale);
        for (const field of ['instruction', 'recipe_section', 'tip'] as const) {
          const desiredVal = block[field];
          if (desiredVal === undefined) continue;
          const currentVal = cur ? cur[field] : null;
          if ((currentVal ?? null) !== desiredVal) {
            changes.push({
              path: `step_text_overrides[order=${target.order}].${locale}.${field}`,
              before: currentVal,
              after: desiredVal,
            });
          }
        }
      }
    }
    sections.push({ section: 'step_text_overrides', changes });
  }

  // -- tags (per-category set replacement) -------------------
  if (desired.tags) {
    const changes: DiffEntry[] = [];
    // Use the schema's TAG_CATEGORIES as the single source of truth so this
    // can't drift from the YAML schema or the RPC's iteration list.
    for (const category of TAG_CATEGORIES) {
      const d = desired.tags[category];
      if (d === undefined) continue;
      const cur = current.tags_by_category[category] ?? [];
      const desiredSet = new Set(d);
      const currentSet = new Set(cur);
      for (const slug of d) {
        if (!currentSet.has(slug)) {
          changes.push({ path: `tags.${category}.+`, before: null, after: slug });
        }
      }
      for (const slug of cur) {
        if (!desiredSet.has(slug)) {
          changes.push({ path: `tags.${category}.-`, before: slug, after: null });
        }
      }
    }
    sections.push({ section: 'tags', changes });
  }

  // -- cleanup.delete_locales --------------------------------
  if (desired.cleanup?.delete_locales) {
    const changes: DiffEntry[] = [];
    for (const locale of desired.cleanup.delete_locales) {
      const c = current.translation_counts_by_locale[locale];
      const recipe = c?.recipe ?? 0;
      const steps = c?.steps ?? 0;
      const ingredients = c?.ingredients ?? 0;
      // Only emit if the locale actually exists at any layer; otherwise the
      // RPC's DELETE statements would no-op and the dry-run would mislead.
      if (recipe + steps + ingredients === 0) continue;
      changes.push({
        path: `cleanup.delete_locales`,
        before: locale,
        after: null,
        details: {
          recipe_translations: recipe,
          step_translations: steps,
          ingredient_translations: ingredients,
        },
      });
    }
    sections.push({ section: 'cleanup', changes });
  }

  const total_changes = sections.reduce((acc, s) => acc + s.changes.length, 0);

  return {
    recipe_id: current.recipe_id,
    recipe_name_en: current.name_en,
    stale_diff: stale,
    ...(stale
      ? {
        stale_diff_detail: {
          db: current.updated_at,
          expected: desired.recipe_match.expected_recipe_updated_at,
        },
      }
      : {}),
    sections,
    total_changes,
  };
}

function matchIngredient(
  match: { existing_id?: string; ingredient_slug?: string; display_order?: number },
  ingredients: IngredientSnapshot[],
): IngredientSnapshot | undefined {
  if (match.existing_id) return ingredients.find((i) => i.id === match.existing_id);
  return ingredients.find(
    (i) => i.slug === match.ingredient_slug && i.display_order === match.display_order,
  );
}

function findStep(
  steps: StepSnapshot[],
  match: { step_id?: string; order?: number },
): StepSnapshot | undefined {
  if (match.step_id) return steps.find((s) => s.id === match.step_id);
  return steps.find((s) => s.order === match.order);
}

function findKitchenTool(
  tools: KitchenToolSnapshot[],
  name_en: string,
): KitchenToolSnapshot | undefined {
  const target = name_en.trim().toLowerCase();
  return tools.find((t) => t.name_en.trim().toLowerCase() === target);
}

function equalsLoose(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null && b === undefined) return true;
  if (b === null && a === undefined) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => equalsLoose(v, b[i]));
  }
  return false;
}

// ============================================================
// Pretty-printer for --dry-run output
// ============================================================

export function formatDiffForCli(diff: RecipeMetadataDiff, verbose: boolean): string {
  const lines: string[] = [];
  if (diff.stale_diff) {
    lines.push(
      `⚠ STALE DIFF: db updated_at=${diff.stale_diff_detail?.db} > expected=${diff.stale_diff_detail?.expected}`,
    );
    lines.push(`  re-run /review-recipe to refresh state before applying`);
    lines.push('');
  }
  lines.push(`CHANGES (${diff.total_changes})`);
  if (diff.total_changes === 0) {
    lines.push(`  (idempotent — apply would be a no-op)`);
    return lines.join('\n');
  }
  let firstSection = true;
  for (const sec of diff.sections) {
    if (sec.changes.length === 0) {
      if (verbose) {
        if (!firstSection) lines.push('');
        lines.push(`  ${sec.section}: (no changes)`);
        firstSection = false;
      }
      continue;
    }
    if (!firstSection) lines.push('');
    lines.push(`  ${sec.section}:`);
    formatSectionChanges(sec, lines);
    firstSection = false;
  }
  return lines.join('\n');
}

/**
 * Render a section's changes. Set-replacement adds/removes (paths ending in
 * `.+` or `.-`) are grouped by the parent path so reviewers see one line per
 * field instead of one line per slug. The section name is stripped from the
 * displayed path because it is already the [section] header above.
 */
function formatSectionChanges(sec: SectionDiff, lines: string[]): void {
  const adds = new Map<string, string[]>();
  const removes = new Map<string, string[]>();
  const scalar: DiffEntry[] = [];

  const stripSectionPrefix = (path: string): string =>
    path.startsWith(`${sec.section}.`) ? path.slice(sec.section.length + 1) : path;

  for (const c of sec.changes) {
    if (c.path.endsWith('.+')) {
      const key = stripSectionPrefix(c.path.slice(0, -2));
      const list = adds.get(key) ?? [];
      list.push(formatSetValue(c.after));
      adds.set(key, list);
    } else if (c.path.endsWith('.-')) {
      const key = stripSectionPrefix(c.path.slice(0, -2));
      const list = removes.get(key) ?? [];
      list.push(formatSetValue(c.before));
      removes.set(key, list);
    } else {
      scalar.push(c);
    }
  }

  // Emit grouped adds/removes per parent path, then scalar changes.
  const setKeys = new Set<string>([...adds.keys(), ...removes.keys()]);
  for (const key of setKeys) {
    const a = adds.get(key);
    const r = removes.get(key);
    if (a) lines.push(`    + ${key}: ${a.join(', ')}`);
    if (r) lines.push(`    - ${key}: ${r.join(', ')}`);
  }
  for (const c of scalar) {
    lines.push(
      `    ~ ${stripSectionPrefix(c.path)}: ${formatVal(c.before)} → ${formatVal(c.after)}`,
    );
    if (c.details) {
      for (const [key, count] of Object.entries(c.details)) {
        const label = key.padEnd(24);
        const unit = count === 1 ? 'row' : 'rows';
        lines.push(`        ${label} ${count} ${unit}`);
      }
    }
  }
}

/**
 * Set-replacement values are known to be slugs or short identifiers — strip
 * the surrounding quotes formatVal would add for arbitrary strings, so
 * `+ cuisine: american` reads cleanly instead of `+ cuisine: 'american'`.
 */
function formatSetValue(v: unknown): string {
  if (typeof v === 'string') return v;
  return formatVal(v);
}

/**
 * Renders an at-a-glance summary of the recipe's current DB state. Goes above
 * the diff in --dry-run output so reviewers can quickly verify the YAML is
 * pointed at the right recipe and gauge what's already populated.
 *
 * One field per line — no multi-column rows — so a reviewer's eye scans
 * straight down without parsing visual columns.
 */
export function formatRecipeSnapshot(current: CurrentRecipeState): string {
  const lines: string[] = [];
  const yn = (v: boolean | null) => v === null ? '—' : v ? 'yes' : 'no';
  const dash = (v: string | null | undefined) =>
    v === null || v === undefined || v === '' ? '—' : v;
  const list = (arr: readonly string[]) => arr.length ? arr.join(', ') : '—';
  const updated = current.updated_at
    ? new Date(current.updated_at).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
    : '?';

  const p = current.planner;
  const t = current.timings;
  const locales = [...new Set(current.translations.map((tr) => tr.locale))].sort();
  const tagCats = Object.keys(current.tags_by_category).sort();

  lines.push('RECIPE');
  lines.push(`  Name:            ${current.name_en ?? '?'}`);
  lines.push(`  ID:              ${current.recipe_id}`);
  lines.push(`  Updated:         ${updated}`);
  lines.push(`  Published:       ${yn(p.is_published)}`);
  lines.push('');

  lines.push('PLANNER');
  lines.push(`  Role:            ${dash(p.planner_role)}`);
  lines.push(`  Alt roles:       ${list(p.alternate_planner_roles)}`);
  lines.push(`  Components:      ${list(p.meal_components)}`);
  lines.push(`  Complete meal:   ${yn(p.is_complete_meal)}`);
  lines.push(`  Equipment:       ${list(p.equipment_tags)}`);
  lines.push(`  Cooking level:   ${dash(p.cooking_level)}`);
  lines.push(`  Batch friendly:  ${yn(p.batch_friendly)}`);
  lines.push(`  Leftovers:       ${yn(p.leftovers_friendly)}`);
  lines.push(`  Max household:   ${p.max_household_size_supported ?? '—'}`);
  lines.push('');

  lines.push('TIMINGS');
  lines.push(`  Prep:            ${t.prep_time === null ? '—' : `${t.prep_time} min`}`);
  lines.push(`  Total:           ${t.total_time === null ? '—' : `${t.total_time} min`}`);
  lines.push(`  Portions:        ${t.portions ?? '—'}`);
  lines.push('');

  lines.push('CONTENT');
  lines.push(`  Ingredients:     ${current.ingredients.length}`);
  lines.push(`  Steps:           ${current.steps.length}`);
  lines.push(
    `  Kitchen tools:   ${
      current.kitchen_tools.length ? current.kitchen_tools.map((k) => k.name_en).join(', ') : '—'
    }`,
  );
  lines.push(`  Pairings:        ${current.pairings.length}`);
  lines.push(`  Locales:         ${locales.length ? locales.join(', ') : '—'}`);
  lines.push('');

  lines.push('TAGS');
  if (tagCats.length === 0) {
    lines.push(`  (none)`);
  } else {
    for (const cat of tagCats) {
      const slugs = current.tags_by_category[cat] ?? [];
      lines.push(`  ${(cat + ':').padEnd(17)}${slugs.join(', ') || '—'}`);
    }
  }

  return lines.join('\n');
}

/**
 * Renders the YAML's requires_authoring block. Returns empty string when no
 * reasons are flagged so the CLI can skip emitting the section header.
 *
 * Notes are reflowed: existing newline structure is preserved, but trailing
 * whitespace on each line is trimmed so the indented block reads cleanly.
 */
export function formatRequiresAuthoring(
  ra: { reasons: string[]; notes?: string } | undefined,
): string {
  if (!ra || ra.reasons.length === 0) return '';
  const lines: string[] = [];
  lines.push('REQUIRES AUTHORING');
  lines.push(`  Status:    not publishable until human-authored`);
  lines.push(`  Reasons:   ${ra.reasons.join(', ')}`);
  if (ra.notes && ra.notes.trim()) {
    lines.push('');
    lines.push('  Notes:');
    // Preserve blank lines from the YAML literal-block scalar so paragraph
    // breaks and list-item separators survive the render. Only strip
    // horizontal whitespace at line end, never the newlines themselves.
    for (const noteLine of ra.notes.replace(/[ \t]+$/gm, '').split('\n')) {
      lines.push(noteLine.length === 0 ? '' : `    ${noteLine}`);
    }
  }
  return lines.join('\n');
}

function formatVal(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') {
    if (v.length > 60) return `'${v.slice(0, 57)}…' (${v.length} chars)`;
    return `'${v}'`;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    return `[${v.slice(0, 5).map(formatVal).join(', ')}${v.length > 5 ? '…' : ''}]`;
  }
  return JSON.stringify(v);
}
