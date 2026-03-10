-- Migration: Add es-ES ingredient translation overrides
-- Author: database-agent
-- Date: 2026-03-10
--
-- Inserts Spain Spanish overrides for ingredients where
-- Mexican Spanish (es) and Spain Spanish (es-ES) differ.
-- Only override rows are stored; all other ingredients
-- fall back through es-ES -> es -> en via resolve_locale().

-- ============================================================
-- 1. Ensure es-ES locale exists
-- ============================================================

INSERT INTO public.locales (code, parent_code, display_name, is_active)
VALUES ('es-ES', 'es', 'Español (España)', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. Insert es-ES overrides for differing ingredient names
-- ============================================================

-- jitomate -> tomate
INSERT INTO public.ingredient_translations (ingredient_id, locale, name, plural_name)
SELECT it.ingredient_id, 'es-ES', 'tomate', 'tomates'
FROM public.ingredient_translations it
WHERE it.locale = 'es' AND it.name = 'jitomate'
ON CONFLICT (ingredient_id, locale) DO NOTHING;

-- jitomate roma -> tomate roma
INSERT INTO public.ingredient_translations (ingredient_id, locale, name, plural_name)
SELECT it.ingredient_id, 'es-ES', 'tomate roma', 'tomates roma'
FROM public.ingredient_translations it
WHERE it.locale = 'es' AND it.name = 'jitomate roma'
ON CONFLICT (ingredient_id, locale) DO NOTHING;

-- cacahuate -> cacahuete
INSERT INTO public.ingredient_translations (ingredient_id, locale, name, plural_name)
SELECT it.ingredient_id, 'es-ES', 'cacahuete', 'cacahuetes'
FROM public.ingredient_translations it
WHERE it.locale = 'es' AND it.name = 'cacahuate'
ON CONFLICT (ingredient_id, locale) DO NOTHING;

-- calabacita -> calabacín
INSERT INTO public.ingredient_translations (ingredient_id, locale, name, plural_name)
SELECT it.ingredient_id, 'es-ES', 'calabacín', 'calabacines'
FROM public.ingredient_translations it
WHERE it.locale = 'es' AND it.name = 'calabacita'
ON CONFLICT (ingredient_id, locale) DO NOTHING;

-- chícharos -> guisantes
INSERT INTO public.ingredient_translations (ingredient_id, locale, name, plural_name)
SELECT it.ingredient_id, 'es-ES', 'guisantes', 'guisantes'
FROM public.ingredient_translations it
WHERE it.locale = 'es' AND it.name = 'chícharos'
ON CONFLICT (ingredient_id, locale) DO NOTHING;

-- crema -> nata
INSERT INTO public.ingredient_translations (ingredient_id, locale, name, plural_name)
SELECT it.ingredient_id, 'es-ES', 'nata', 'nata'
FROM public.ingredient_translations it
WHERE it.locale = 'es' AND it.name = 'crema'
ON CONFLICT (ingredient_id, locale) DO NOTHING;

-- crema ácida -> nata agria
INSERT INTO public.ingredient_translations (ingredient_id, locale, name, plural_name)
SELECT it.ingredient_id, 'es-ES', 'nata agria', 'nata agria'
FROM public.ingredient_translations it
WHERE it.locale = 'es' AND it.name = 'crema ácida'
ON CONFLICT (ingredient_id, locale) DO NOTHING;

-- granos de elote -> granos de maíz
INSERT INTO public.ingredient_translations (ingredient_id, locale, name, plural_name)
SELECT it.ingredient_id, 'es-ES', 'granos de maíz', 'granos de maíz'
FROM public.ingredient_translations it
WHERE it.locale = 'es' AND it.name = 'granos de elote'
ON CONFLICT (ingredient_id, locale) DO NOTHING;

-- jugo de lima -> zumo de lima
INSERT INTO public.ingredient_translations (ingredient_id, locale, name, plural_name)
SELECT it.ingredient_id, 'es-ES', 'zumo de lima', 'zumo de lima'
FROM public.ingredient_translations it
WHERE it.locale = 'es' AND it.name = 'jugo de lima'
ON CONFLICT (ingredient_id, locale) DO NOTHING;

-- jugo de limón -> zumo de limón
INSERT INTO public.ingredient_translations (ingredient_id, locale, name, plural_name)
SELECT it.ingredient_id, 'es-ES', 'zumo de limón', 'zumo de limón'
FROM public.ingredient_translations it
WHERE it.locale = 'es' AND it.name = 'jugo de limón'
ON CONFLICT (ingredient_id, locale) DO NOTHING;

-- jugo de naranja -> zumo de naranja
INSERT INTO public.ingredient_translations (ingredient_id, locale, name, plural_name)
SELECT it.ingredient_id, 'es-ES', 'zumo de naranja', 'zumo de naranja'
FROM public.ingredient_translations it
WHERE it.locale = 'es' AND it.name = 'jugo de naranja'
ON CONFLICT (ingredient_id, locale) DO NOTHING;

-- papa -> patata
INSERT INTO public.ingredient_translations (ingredient_id, locale, name, plural_name)
SELECT it.ingredient_id, 'es-ES', 'patata', 'patatas'
FROM public.ingredient_translations it
WHERE it.locale = 'es' AND it.name = 'papa'
ON CONFLICT (ingredient_id, locale) DO NOTHING;

-- poro -> puerro
INSERT INTO public.ingredient_translations (ingredient_id, locale, name, plural_name)
SELECT it.ingredient_id, 'es-ES', 'puerro', 'puerros'
FROM public.ingredient_translations it
WHERE it.locale = 'es' AND it.name = 'poro'
ON CONFLICT (ingredient_id, locale) DO NOTHING;
