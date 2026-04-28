/**
 * Notion Tag Map — coverage regression test.
 *
 * Guarantees that every legacy Notion tag observed in scan-report.json has
 * either a forward mapping in NOTION_TAG_MAP or an explicit entry in
 * INTENTIONAL_DROPS. Also asserts that every mapped slug exists in the
 * canonical taxonomy seed (so a typo in the map fails CI immediately
 * rather than silently dropping links at import time).
 */

import { assertEquals, assertExists } from 'std/assert/mod.ts';
import { INTENTIONAL_DROPS, NOTION_TAG_MAP } from '../notion-tag-map.ts';

const SCAN_REPORT_PATH = new URL(
  '../../scan-report.json',
  import.meta.url,
);
const MIGRATION_PATH = new URL(
  '../../../supabase/migrations/20260427022448_tag_system_rebuild.sql',
  import.meta.url,
);

interface TagListing {
  name: string;
  count: number;
}

interface ScanReport {
  matchedTags: TagListing[];
  missingTags: TagListing[];
}

/** Read the canonical slug set out of the migration's seed VALUES block. */
async function loadCanonicalSlugs(): Promise<Set<string>> {
  const sql = await Deno.readTextFile(MIGRATION_PATH);

  // The seed CTE rows look like:
  //   ('slug', 'category', 'Name En', 'Name Es'),
  // We grab the slug from the first single-quoted column on lines whose
  // second column is one of the canonical category enum members.
  const seedRowRegex =
    /\(\s*'([a-z0-9_]+)'\s*,\s*'(cuisine|meal_type|diet|dish_type|primary_ingredient|occasion|practical)'/g;

  const slugs = new Set<string>();
  for (const match of sql.matchAll(seedRowRegex)) {
    slugs.add(match[1]);
  }
  return slugs;
}

/** Read the migration's legacy_tag_remap keys (lowercase legacy names). */
async function loadLegacyRemapKeys(): Promise<Set<string>> {
  const sql = await Deno.readTextFile(MIGRATION_PATH);

  // Isolate the INSERT INTO legacy_tag_remap (...) VALUES ... ; block so we
  // don't accidentally pick up tuples from elsewhere.
  const blockMatch = sql.match(
    /INSERT INTO legacy_tag_remap[^;]*VALUES([\s\S]+?);/,
  );
  if (!blockMatch) {
    throw new Error(
      "Could not find legacy_tag_remap INSERT block in the migration",
    );
  }

  // Each row: ('legacy name', 'slug'),
  const rowRegex = /\(\s*'([^']+)'\s*,\s*'([a-z0-9_]+)'\s*\)/g;
  const keys = new Set<string>();
  for (const m of blockMatch[1].matchAll(rowRegex)) {
    keys.add(m[1]);
  }
  return keys;
}

async function loadScanReport(): Promise<ScanReport> {
  const raw = await Deno.readTextFile(SCAN_REPORT_PATH);
  return JSON.parse(raw) as ScanReport;
}

Deno.test('notion-tag-map: every observed tag is mapped or intentionally dropped', async () => {
  const report = await loadScanReport();
  const observed = [...report.matchedTags, ...report.missingTags].map((t) => t.name);

  const drops = new Set(INTENTIONAL_DROPS);
  const unmapped: string[] = [];
  for (const name of observed) {
    if (NOTION_TAG_MAP[name] || drops.has(name)) continue;
    unmapped.push(name);
  }

  assertEquals(
    unmapped,
    [],
    `Found Notion tags with no mapping and no INTENTIONAL_DROPS entry: ${
      unmapped.join(', ')
    }. Add them to NOTION_TAG_MAP or INTENTIONAL_DROPS.`,
  );
});

Deno.test('notion-tag-map: every mapped slug exists in the canonical taxonomy seed', async () => {
  const canonical = await loadCanonicalSlugs();

  // Sanity-check the seed parser caught a non-trivial number of slugs.
  // If this fails the regex above is broken, not the data.
  assertEquals(
    canonical.size > 50,
    true,
    `Expected the migration seed to contain >50 canonical slugs, got ${canonical.size}. The seed parser regex may be out of sync.`,
  );

  const broken: Array<{ legacy: string; slug: string }> = [];
  for (const [legacyName, mapping] of Object.entries(NOTION_TAG_MAP)) {
    if (!canonical.has(mapping.slug)) {
      broken.push({ legacy: legacyName, slug: mapping.slug });
    }
  }

  assertEquals(
    broken,
    [],
    `Notion tag map references slugs that don't exist in the canonical seed: ${
      broken.map((b) => `${b.legacy} -> ${b.slug}`).join(', ')
    }`,
  );
});

Deno.test('notion-tag-map: INTENTIONAL_DROPS entries are not also mapped', () => {
  const overlaps = INTENTIONAL_DROPS.filter((name) => NOTION_TAG_MAP[name]);
  assertEquals(
    overlaps,
    [],
    `Tag(s) appear in both NOTION_TAG_MAP and INTENTIONAL_DROPS: ${overlaps.join(', ')}. Pick one.`,
  );
});

Deno.test('migration legacy_tag_remap: covers every NOTION_TAG_MAP en/es value', async () => {
  const remapKeys = await loadLegacyRemapKeys();

  // Sanity-check the parser caught a non-trivial number of rows.
  assertEquals(
    remapKeys.size > 30,
    true,
    `Expected the migration legacy_tag_remap to contain >30 rows, got ${remapKeys.size}. The remap parser regex may be out of sync.`,
  );

  // Every translation row written by the importer (current OR historic)
  // should be remappable. We lowercase to match the migration's
  // case-insensitive join.
  const drops = new Set(INTENTIONAL_DROPS);
  const missing: string[] = [];
  for (const [legacyName, mapping] of Object.entries(NOTION_TAG_MAP)) {
    if (drops.has(legacyName)) continue;
    for (const value of [mapping.en, mapping.es]) {
      const key = value.toLowerCase();
      if (!remapKeys.has(key)) {
        missing.push(`${legacyName} -> ${value}`);
      }
    }
  }

  assertEquals(
    missing,
    [],
    `Migration legacy_tag_remap is missing entries for these NOTION_TAG_MAP values: ${
      missing.join(', ')
    }. Add lowercase versions to the legacy_tag_remap INSERT block.`,
  );
});

Deno.test('notion-tag-map: scan-report can be loaded and is non-empty', async () => {
  const report = await loadScanReport();
  assertExists(report.matchedTags);
  assertExists(report.missingTags);
  assertEquals(
    report.matchedTags.length + report.missingTags.length > 0,
    true,
    'scan-report.json appears empty',
  );
});
