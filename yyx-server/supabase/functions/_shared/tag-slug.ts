const TAG_SLUG_ALIASES: Record<string, string> = {
  americana: "american",
  asiatica: "asian",
  china: "chinese",
  coreana: "korean",
  del_medio_oriente: "middle_eastern",
  espanola: "spanish",
  francesa: "french",
  griega: "greek",
  india: "indian",
  italiana: "italian",
  japonesa: "japanese",
  mediterranea: "mediterranean",
  mexicana: "mexican",
  tailandesa: "thai",
};

export function normalizeTagSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");

  return TAG_SLUG_ALIASES[slug] || slug;
}
