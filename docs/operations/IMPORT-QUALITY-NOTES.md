# Import Quality Notes

Known quality observations from the recipe import pipeline. These are not bugs — they're content-level issues to be aware of when reviewing imported data.

## Ingredient Variants

The AI parser sometimes creates distinct ingredients for what could be considered variants of the same base ingredient:

| Created As | Existing | Notes |
|-----------|----------|-------|
| Dried oregano | Oregano | Legitimately different products (dried vs fresh) |
| Dried thyme | Thyme | Same — dried herb is a different product |
| Ground black pepper | Black pepper | Ground vs whole peppercorns |
| Fine salt | Salt | Different granularity |
| Coarse salt | Salt | Different granularity |

**Assessment:** These are correct as-is. "Dried oregano" and "oregano" (fresh) are distinct items a user would buy separately. The entity matcher intentionally does not conflate them (0.95 similarity threshold). If consolidation is desired later, merge via admin panel.

## Kitchen Tool Exclusions

The parser occasionally extracts common appliances from recipe instructions (e.g., "refrigerate for 2 hours" produces "Refrigerator" as a kitchen tool). An exclusion list filters these out during import:

- Refrigerator / Refrigerador / Nevera / Frigorífico
- Oven / Horno
- Stove / Estufa
- Microwave / Microondas
- Freezer / Congelador
- Toaster / Tostador
- Dishwasher / Lavavajillas

**If new false positives appear**, add them to `EXCLUDED_KITCHEN_TOOLS` in `data-pipeline/cli/import-recipes.ts`.

**Already-created junk tools** (from batches before the exclusion list): clean up via admin panel.

## Translation Edge Cases

Occasionally the AI translator returns the original word untranslated when it's a loanword or brand name:

| Ingredient | ES Translation | Expected |
|-----------|---------------|----------|
| Cracker | Cracker | Galleta salada |

These are rare one-offs, not systemic. Fix individually in the admin panel.

## Prep Time / Total Time Zeros

Some recipes import with `prep_time=0` or `total_time=0`. This happens when the Notion source doesn't include timing metadata. The pipeline defaults to 0 rather than guessing. These can be backfilled manually or via a future audit script.
