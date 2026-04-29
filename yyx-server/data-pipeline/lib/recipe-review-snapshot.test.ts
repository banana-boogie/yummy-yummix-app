import { assertEquals, assertMatch } from 'std/assert/mod.ts';
import {
  buildSnapshotFilename,
  formatSnapshotTimestamp,
  parseManifest,
  resolveManifest,
  sanitiseLabel,
} from './recipe-review-snapshot.ts';

// ─── filename / timestamp / label ──────────────────────

Deno.test('formatSnapshotTimestamp: replaces colons and drops millisecond fraction', () => {
  const t = new Date(Date.UTC(2026, 3, 28, 22, 45, 0, 123));
  assertEquals(formatSnapshotTimestamp(t), '2026-04-28T22-45-00Z');
});

Deno.test('sanitiseLabel: kebab-cases free text and strips diacritics', () => {
  assertEquals(sanitiseLabel('Published Review'), 'published-review');
  assertEquals(sanitiseLabel('Café Audit!!'), 'cafe-audit');
  assertEquals(sanitiseLabel('a---b//c'), 'a-b-c');
  assertEquals(sanitiseLabel('--leading--'), 'leading');
});

Deno.test('sanitiseLabel: clamps to 60 chars and returns null on empty', () => {
  const long = 'x'.repeat(120);
  assertEquals(sanitiseLabel(long)!.length, 60);
  assertEquals(sanitiseLabel(''), null);
  assertEquals(sanitiseLabel(null), null);
  assertEquals(sanitiseLabel(undefined), null);
  assertEquals(sanitiseLabel('!!!'), null);
});

Deno.test('buildSnapshotFilename: includes label when present', () => {
  const t = new Date(Date.UTC(2026, 3, 28, 22, 45, 0));
  assertEquals(
    buildSnapshotFilename(t, 'published-review'),
    '2026-04-28T22-45-00Z_published-review.json',
  );
});

Deno.test('buildSnapshotFilename: omits label suffix when empty', () => {
  const t = new Date(Date.UTC(2026, 3, 28, 22, 45, 0));
  assertEquals(buildSnapshotFilename(t, null), '2026-04-28T22-45-00Z.json');
  assertEquals(buildSnapshotFilename(t, ''), '2026-04-28T22-45-00Z.json');
});

Deno.test('buildSnapshotFilename: filename matches expected shape', () => {
  const out = buildSnapshotFilename(new Date(Date.UTC(2026, 3, 28, 22, 45, 0)), 'My Label');
  // shape: <iso>_<kebab>.json — no colons, no whitespace, no uppercase except 'T'/'Z'
  assertMatch(out, /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z(_[a-z0-9-]+)?\.json$/);
});

// ─── manifest parsing ───────────────────────────────────

Deno.test('parseManifest: separates UUIDs from names', () => {
  const text = [
    '8e3a9b2c-aaaa-bbbb-cccc-1234567890ab',
    'Mongolian Beef',
    '# a comment',
    '',
    '   Tortilla Soup  ',
    'CC11DD22-EE33-4F44-9555-AAAA66667777',
  ].join('\n');
  const parsed = parseManifest(text);
  assertEquals(parsed.ids, [
    '8e3a9b2c-aaaa-bbbb-cccc-1234567890ab',
    'cc11dd22-ee33-4f44-9555-aaaa66667777',
  ]);
  assertEquals(parsed.names, ['Mongolian Beef', 'Tortilla Soup']);
  // raw preserves order and trims, but excludes blanks/comments
  assertEquals(parsed.raw, [
    '8e3a9b2c-aaaa-bbbb-cccc-1234567890ab',
    'Mongolian Beef',
    'Tortilla Soup',
    'CC11DD22-EE33-4F44-9555-AAAA66667777',
  ]);
});

Deno.test('parseManifest: empty content yields empty result', () => {
  const parsed = parseManifest('\n\n  \n# only comments\n');
  assertEquals(parsed.ids, []);
  assertEquals(parsed.names, []);
  assertEquals(parsed.raw, []);
});

// ─── resolveManifest: duplicate-name detection (mocked Supabase) ──

interface MockRow {
  recipe_id: string;
  locale: string;
  name: string;
}

function makeMockSupabase(opts: {
  recipeIds: string[];
  translations: MockRow[];
}) {
  // Minimal PostgREST query-builder shim: only the methods used by
  // resolveManifest. Each `from()` returns a chain that resolves to
  // `{ data, error }` when awaited.
  return {
    from(table: string) {
      if (table === 'recipes') {
        return {
          select: () => ({
            in: (_col: string, ids: string[]) => {
              const found = opts.recipeIds.filter((id) =>
                ids.map((x) => x.toLowerCase()).includes(id.toLowerCase())
              );
              return Promise.resolve({
                data: found.map((id) => ({ id })),
                error: null,
              });
            },
          }),
        };
      }
      if (table === 'recipe_translations') {
        return {
          select: () => ({
            ilike: (_col: string, name: string) => ({
              in: (_lcol: string, _locales: string[]) => {
                const matches = opts.translations.filter((t) =>
                  t.name.toLowerCase() === name.toLowerCase()
                );
                return Promise.resolve({ data: matches, error: null });
              },
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

Deno.test('resolveManifest: id present resolves; id missing surfaces not_found', async () => {
  const mock = makeMockSupabase({
    recipeIds: ['8e3a9b2c-aaaa-bbbb-cccc-1234567890ab'],
    translations: [],
  });
  const res = await resolveManifest(
    // deno-lint-ignore no-explicit-any
    mock as any,
    {
      ids: [
        '8e3a9b2c-aaaa-bbbb-cccc-1234567890ab',
        '00000000-0000-0000-0000-000000000000',
      ],
      names: [],
      raw: [],
    },
  );
  assertEquals([...res.ids], ['8e3a9b2c-aaaa-bbbb-cccc-1234567890ab']);
  assertEquals(res.unresolved.length, 1);
  assertEquals(res.unresolved[0].input, '00000000-0000-0000-0000-000000000000');
  assertEquals(res.unresolved[0].reason, 'not_found');
});

Deno.test('resolveManifest: ambiguous name surfaces with all candidate ids', async () => {
  const mock = makeMockSupabase({
    recipeIds: [],
    translations: [
      { recipe_id: 'aaa-1', locale: 'en', name: 'Soup' },
      { recipe_id: 'bbb-2', locale: 'en', name: 'Soup' },
    ],
  });
  const res = await resolveManifest(
    // deno-lint-ignore no-explicit-any
    mock as any,
    { ids: [], names: ['Soup'], raw: ['Soup'] },
  );
  assertEquals(res.ids.size, 0);
  assertEquals(res.unresolved.length, 1);
  assertEquals(res.unresolved[0].reason, 'ambiguous');
  assertEquals(res.unresolved[0].matches.length, 2);
});

Deno.test('resolveManifest: unique name resolves to a single id', async () => {
  const mock = makeMockSupabase({
    recipeIds: [],
    translations: [
      { recipe_id: 'recipe-uuid-1', locale: 'en', name: 'Mongolian Beef' },
      { recipe_id: 'recipe-uuid-1', locale: 'es', name: 'Res Mongola' },
    ],
  });
  const res = await resolveManifest(
    // deno-lint-ignore no-explicit-any
    mock as any,
    { ids: [], names: ['Mongolian Beef'], raw: ['Mongolian Beef'] },
  );
  assertEquals([...res.ids], ['recipe-uuid-1']);
  assertEquals(res.unresolved.length, 0);
});

Deno.test('resolveManifest: name with no match surfaces not_found', async () => {
  const mock = makeMockSupabase({ recipeIds: [], translations: [] });
  const res = await resolveManifest(
    // deno-lint-ignore no-explicit-any
    mock as any,
    { ids: [], names: ['Nonexistent Recipe'], raw: ['Nonexistent Recipe'] },
  );
  assertEquals(res.ids.size, 0);
  assertEquals(res.unresolved.length, 1);
  assertEquals(res.unresolved[0].reason, 'not_found');
});

// ─── pointer-file shape (sanity check) ────────────────

import { type ReviewSnapshotPointer, SNAPSHOT_VERSION } from './recipe-review-snapshot.ts';

Deno.test('SNAPSHOT_VERSION is 1 (bump intentionally on schema change)', () => {
  assertEquals(SNAPSHOT_VERSION, 1);
});

Deno.test('latest.json pointer shape: required fields are present', () => {
  const pointer: ReviewSnapshotPointer = {
    snapshot_file: '2026-04-28T22-45-00Z_published-review.json',
    created_at: '2026-04-28T22:45:00.000Z',
    scope: 'published',
    label: 'published-review',
    recipe_count: 21,
  };
  // The CLI writes JSON.stringify(pointer, null, 2). Verify all keys are
  // serialised so reviewers can parse the pointer without extra plumbing.
  const serialised = JSON.parse(JSON.stringify(pointer));
  assertEquals(typeof serialised.snapshot_file, 'string');
  assertEquals(typeof serialised.created_at, 'string');
  assertEquals(serialised.scope, 'published');
  assertEquals(serialised.label, 'published-review');
  assertEquals(serialised.recipe_count, 21);
});
