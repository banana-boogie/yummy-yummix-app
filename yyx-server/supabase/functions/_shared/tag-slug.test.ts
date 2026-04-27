import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { normalizeTagSlug } from "./tag-slug.ts";

Deno.test("normalizeTagSlug maps seeded Spanish cuisine names to canonical slugs", () => {
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
    assertEquals(normalizeTagSlug(input), expected);
  }
});

Deno.test("normalizeTagSlug preserves canonical slug inputs", () => {
  assertEquals(normalizeTagSlug("middle_eastern"), "middle_eastern");
  assertEquals(normalizeTagSlug("low-sugar"), "low_sugar");
});
