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

## Kitchen Tools from Appliances

The parser extracts appliances like Oven, Refrigerator, Freezer, and Stove as kitchen tools. This is intentional — it's useful context for the cook to know they'll need these (e.g., preheat oven, refrigerate overnight). Some recipes imported during an earlier batch with an exclusion list may be missing these tools; they were linked correctly in later batches.

## Translation Edge Cases

Occasionally the AI translator returns the original word untranslated when it's a loanword or brand name:

| Ingredient | ES Translation | Expected |
|-----------|---------------|----------|
| Cracker | Cracker | Galleta salada |

These are rare one-offs, not systemic. Fix individually in the admin panel.

## Prep Time / Total Time Zeros

Some recipes import with `prep_time=0` or `total_time=0`. This happens when the Notion source doesn't include timing metadata. The pipeline defaults to 0 rather than guessing. ~35% of recipes are affected. These can be backfilled manually or via a future audit script.

## Missing Tips

~47% of imported recipes have no tips_and_tricks. This is expected — many Notion source files simply don't include tips.

## Large Recipe Parsing Failures

Very long recipes (e.g., "Cena para 10 en 1 hora" — a multi-course dinner) can cause OpenAI to return truncated JSON, resulting in a parse error. The progress tracker marks these as failed so they retry on the next run. If they keep failing, the recipe may need manual entry or the token limit may need increasing in the parser.
