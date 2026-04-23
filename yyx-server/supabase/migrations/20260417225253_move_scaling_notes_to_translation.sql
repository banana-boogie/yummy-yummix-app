-- Move scaling notes from recipes.requires_multi_batch_note (base table)
-- to recipe_translations.scaling_notes (translation table).
--
-- Rationale: scaling notes are free-form user-facing cooking guidance
-- (e.g., "Thermomix bowl fits one batch of 4 servings. For 6+ people,
-- blend sauce in two batches."). Free-form user-facing text must be
-- authored per locale; storing it on the base table would force
-- Spanish users to see English-only guidance.
--
-- Column is effectively empty in production at the time of this
-- migration, so no content backfill is needed. If rows appear between
-- this migration being written and it running, they are English-only
-- admin placeholders and can be safely discarded with the column drop.
--
-- Policy going forward: any new free-form user-facing text field on a
-- recipe MUST be added to recipe_translations, not the base recipes
-- table. The base table holds only enums, numbers, booleans, and tag
-- references.

ALTER TABLE public.recipe_translations
    ADD COLUMN IF NOT EXISTS scaling_notes TEXT;

ALTER TABLE public.recipes
    DROP COLUMN IF EXISTS requires_multi_batch_note;
