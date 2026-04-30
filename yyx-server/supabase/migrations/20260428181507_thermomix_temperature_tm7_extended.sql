-- Add TM7-extended Celsius and Fahrenheit values to the
-- thermomix_temperature_type enum so TM7 recipes can store them in
-- structured fields instead of buried in step prose.
--
-- Source of truth for the TM7-extended set:
--   yyx-app/types/thermomix.types.ts
--     TM7_EXTENDED_CELSIUS    = [125, 130, 135, 140, 145, 150, 155, 160]
--     TM7_EXTENDED_FAHRENHEIT = [257, 266, 275, 284, 293, 302, 311, 320]
--
-- 130 / 140 / 150 / 160 °C are already in the enum, so this migration only
-- adds the missing 4 Celsius values + all 8 TM7 Fahrenheit values.
--
-- ALTER TYPE ... ADD VALUE is non-transactional in Postgres, so each
-- statement is its own implicit commit. IF NOT EXISTS guards make it
-- idempotent on re-run.

ALTER TYPE public.thermomix_temperature_type ADD VALUE IF NOT EXISTS '125';
ALTER TYPE public.thermomix_temperature_type ADD VALUE IF NOT EXISTS '135';
ALTER TYPE public.thermomix_temperature_type ADD VALUE IF NOT EXISTS '145';
ALTER TYPE public.thermomix_temperature_type ADD VALUE IF NOT EXISTS '155';

ALTER TYPE public.thermomix_temperature_type ADD VALUE IF NOT EXISTS '257';
ALTER TYPE public.thermomix_temperature_type ADD VALUE IF NOT EXISTS '266';
ALTER TYPE public.thermomix_temperature_type ADD VALUE IF NOT EXISTS '275';
ALTER TYPE public.thermomix_temperature_type ADD VALUE IF NOT EXISTS '284';
ALTER TYPE public.thermomix_temperature_type ADD VALUE IF NOT EXISTS '293';
ALTER TYPE public.thermomix_temperature_type ADD VALUE IF NOT EXISTS '302';
ALTER TYPE public.thermomix_temperature_type ADD VALUE IF NOT EXISTS '311';
ALTER TYPE public.thermomix_temperature_type ADD VALUE IF NOT EXISTS '320';

-- Refresh the COMMENT ON TYPE so the "known gap" note no longer applies.
COMMENT ON TYPE public.thermomix_temperature_type IS
  'Thermomix temperature values. Mirrored by VALID_TEMPERATURE_NUMBERS in '
  'yyx-server/data-pipeline/lib/recipe-metadata-schema.ts. Includes TM7-'
  'extended Celsius (125/135/145/155 plus 130/140/150/160) and Fahrenheit '
  '(257/266/275/284/293/302/311/320) values.';
