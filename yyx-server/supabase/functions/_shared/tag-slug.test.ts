import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { _resetTagSlugCacheForTests, normalizeTagSlug } from "./tag-slug.ts";

/**
 * Build a fake supabase client whose `.from("recipe_tags").select(...)`
 * returns the seeded cuisine taxonomy joined with en/es translations.
 * The translations table is the source of truth for aliases now —
 * tag-slug.ts derives its alias map from this query.
 */
function makeFakeSupabase(
  rows: Array<{
    slug: string;
    recipe_tag_translations: Array<{ name: string }>;
  }>,
) {
  // deno-lint-ignore no-explicit-any
  return {
    from(_table: string) {
      return {
        select(_cols: string) {
          return Promise.resolve({ data: rows, error: null });
        },
      };
    },
  } as any;
}

const CUISINE_FIXTURE = makeFakeSupabase([
  {
    slug: "mexican",
    recipe_tag_translations: [{ name: "Mexican" }, { name: "Mexicana" }],
  },
  {
    slug: "italian",
    recipe_tag_translations: [{ name: "Italian" }, { name: "Italiana" }],
  },
  {
    slug: "japanese",
    recipe_tag_translations: [{ name: "Japanese" }, { name: "Japonesa" }],
  },
  {
    slug: "thai",
    recipe_tag_translations: [{ name: "Thai" }, { name: "Tailandesa" }],
  },
  {
    slug: "chinese",
    recipe_tag_translations: [{ name: "Chinese" }, { name: "China" }],
  },
  {
    slug: "korean",
    recipe_tag_translations: [{ name: "Korean" }, { name: "Coreana" }],
  },
  {
    slug: "middle_eastern",
    recipe_tag_translations: [
      { name: "Middle Eastern" },
      { name: "Del Medio Oriente" },
    ],
  },
  {
    slug: "indian",
    recipe_tag_translations: [{ name: "Indian" }, { name: "India" }],
  },
  {
    slug: "american",
    recipe_tag_translations: [{ name: "American" }, { name: "Americana" }],
  },
  {
    slug: "french",
    recipe_tag_translations: [{ name: "French" }, { name: "Francesa" }],
  },
  {
    slug: "spanish",
    recipe_tag_translations: [{ name: "Spanish" }, { name: "Española" }],
  },
  {
    slug: "mediterranean",
    recipe_tag_translations: [
      { name: "Mediterranean" },
      { name: "Mediterránea" },
    ],
  },
  {
    slug: "greek",
    recipe_tag_translations: [{ name: "Greek" }, { name: "Griega" }],
  },
  {
    slug: "asian",
    recipe_tag_translations: [{ name: "Asian" }, { name: "Asiática" }],
  },
  {
    slug: "low_sugar",
    recipe_tag_translations: [{ name: "Low Sugar" }, {
      name: "Bajo en Azúcar",
    }],
  },
]);

Deno.test("normalizeTagSlug maps Spanish cuisine display names to canonical slugs", async () => {
  _resetTagSlugCacheForTests();
  const cases: Array<[string, string]> = [
    ["Mexicana", "mexican"],
    ["Italiana", "italian"],
    ["Japonesa", "japanese"],
    ["Tailandesa", "thai"],
    ["China", "chinese"],
    ["Coreana", "korean"],
    ["Del Medio Oriente", "middle_eastern"],
    ["India", "indian"],
    ["Americana", "american"],
    ["Francesa", "french"],
    ["Española", "spanish"],
    ["Mediterránea", "mediterranean"],
    ["Griega", "greek"],
    ["Asiática", "asian"],
  ];

  for (const [input, expected] of cases) {
    assertEquals(await normalizeTagSlug(input, CUISINE_FIXTURE), expected);
  }
});

Deno.test("normalizeTagSlug preserves canonical slug inputs", async () => {
  _resetTagSlugCacheForTests();
  assertEquals(
    await normalizeTagSlug("middle_eastern", CUISINE_FIXTURE),
    "middle_eastern",
  );
  assertEquals(
    await normalizeTagSlug("low-sugar", CUISINE_FIXTURE),
    "low_sugar",
  );
});

Deno.test("normalizeTagSlug returns the slugified input when no alias is found", async () => {
  _resetTagSlugCacheForTests();
  assertEquals(
    await normalizeTagSlug("Marroquí", CUISINE_FIXTURE),
    "marroqui",
  );
});

Deno.test("normalizeTagSlug falls through gracefully when the alias load fails", async () => {
  _resetTagSlugCacheForTests();
  // deno-lint-ignore no-explicit-any
  const failing: any = {
    from: () => ({
      select: () => Promise.resolve({ data: null, error: { message: "boom" } }),
    }),
  };

  // No alias map available → input is just slugified, no canonicalization.
  assertEquals(await normalizeTagSlug("Mexicana", failing), "mexicana");
});
