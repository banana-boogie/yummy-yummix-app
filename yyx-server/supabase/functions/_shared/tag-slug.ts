import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Normalize a free-form tag value (typed by a user or emitted by the LLM)
 * into a canonical recipe-tag slug. Aliases are derived from
 * `recipe_tag_translations` at first use and cached for the container's
 * lifetime, so adding a new locale or renaming a display name is a
 * data change — no code change or redeploy needed.
 */

interface TagWithTranslations {
  slug: string | null;
  recipe_tag_translations: Array<{ name: string | null }> | null;
}

let cachedAliases: Map<string, string> | null = null;
let inflightLoad: Promise<Map<string, string>> | null = null;

function baseSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}

async function loadAliases(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  if (cachedAliases) return cachedAliases;
  if (inflightLoad) return inflightLoad;

  inflightLoad = (async () => {
    const { data, error } = await supabase
      .from("recipe_tags")
      .select("slug, recipe_tag_translations(name)");

    if (error) {
      console.error("[tag-slug] failed to load aliases:", error.message);
      return new Map<string, string>();
    }

    const map = new Map<string, string>();
    for (const tag of (data ?? []) as TagWithTranslations[]) {
      if (!tag.slug) continue;
      // The canonical slug must always resolve to itself.
      map.set(tag.slug, tag.slug);
      for (const tr of tag.recipe_tag_translations ?? []) {
        if (!tr.name) continue;
        const normalized = baseSlug(tr.name);
        // First writer wins on collision; canonical slugs are inserted
        // first, so a translation can never overwrite a canonical mapping.
        if (!map.has(normalized)) {
          map.set(normalized, tag.slug);
        }
      }
    }

    cachedAliases = map;
    return map;
  })().finally(() => {
    inflightLoad = null;
  });

  return inflightLoad;
}

export async function normalizeTagSlug(
  value: string,
  supabase: SupabaseClient,
): Promise<string> {
  const slug = baseSlug(value);
  const aliases = await loadAliases(supabase);
  return aliases.get(slug) ?? slug;
}

/** Test-only: clear the in-memory alias cache between test cases. */
export function _resetTagSlugCacheForTests(): void {
  cachedAliases = null;
  inflightLoad = null;
}
