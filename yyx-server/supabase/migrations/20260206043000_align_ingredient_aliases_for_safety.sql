-- [Ingredient Matching 3/4] Align ingredient aliases with food safety canonicals
-- Related: 20260206025947 (threshold), 20260206035255 (batch), 20260206050655 (batch fix)
-- Enforces case-insensitive uniqueness on alias + language.

-- Remove case-insensitive duplicates first (keep oldest row deterministically).
WITH ranked_aliases AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(alias)), language
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS row_num
  FROM public.ingredient_aliases
)
DELETE FROM public.ingredient_aliases ia
USING ranked_aliases ra
WHERE ia.id = ra.id
  AND ra.row_num > 1;

-- Normalize existing values.
UPDATE public.ingredient_aliases
SET
  alias = lower(trim(alias)),
  canonical = lower(trim(canonical));

-- Map ground-meat aliases to stricter food safety canonicals.
UPDATE public.ingredient_aliases
SET canonical = CASE
  WHEN lower(alias) IN ('ground beef', 'carne molida') THEN 'ground_beef'
  WHEN lower(alias) IN ('ground pork', 'cerdo molido') THEN 'ground_pork'
  WHEN lower(alias) IN ('ground lamb', 'cordero molido') THEN 'ground_lamb'
  ELSE canonical
END
WHERE lower(alias) IN (
  'ground beef',
  'carne molida',
  'ground pork',
  'cerdo molido',
  'ground lamb',
  'cordero molido'
);

-- Seed explicit ground-meat aliases for EN/ES normalization coverage.
INSERT INTO public.ingredient_aliases (canonical, alias, language) VALUES
  ('ground_beef', 'ground beef', 'en'),
  ('ground_beef', 'carne molida', 'es'),
  ('ground_pork', 'ground pork', 'en'),
  ('ground_pork', 'cerdo molido', 'es'),
  ('ground_lamb', 'ground lamb', 'en'),
  ('ground_lamb', 'cordero molido', 'es')
ON CONFLICT DO NOTHING;

-- Replace case-sensitive uniqueness with case-insensitive uniqueness.
ALTER TABLE public.ingredient_aliases
DROP CONSTRAINT IF EXISTS ingredient_aliases_alias_language_key;

DROP INDEX IF EXISTS public.idx_ingredient_aliases_alias_lang;

CREATE UNIQUE INDEX idx_ingredient_aliases_alias_lang
ON public.ingredient_aliases (lower(alias), language);

