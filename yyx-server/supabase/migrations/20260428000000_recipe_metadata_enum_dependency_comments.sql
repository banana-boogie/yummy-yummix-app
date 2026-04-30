-- Drift guards for the recipe-metadata pipeline (Plan 12).
--
-- The YAML schema at yyx-server/data-pipeline/lib/recipe-metadata-schema.ts
-- mirrors three Postgres enums by hand. If the enum is extended in the DB
-- without updating the schema, YAMLs using the new value will be rejected
-- by Zod (best case) or fail at apply with an opaque enum cast error
-- (worst case). These COMMENTs are visible via `\dT+` in psql and serve
-- as a pointer for whoever next ALTERs the enum.

COMMENT ON TYPE public.recipe_tag_category IS
  'Track H tag categories. Mirrored by TAG_CATEGORIES in '
  'yyx-server/data-pipeline/lib/recipe-metadata-schema.ts and the iteration '
  'list inside apply_recipe_metadata RPC. When extending, update both.';

COMMENT ON TYPE public.thermomix_speed_type IS
  'Thermomix speed values. Mirrored by VALID_SPEED_NUMBERS in '
  'yyx-server/data-pipeline/lib/recipe-metadata-schema.ts. When extending '
  '(e.g. for TM7 values), update the schema in lockstep.';

COMMENT ON TYPE public.thermomix_temperature_type IS
  'Thermomix temperature values. Mirrored by VALID_TEMPERATURE_NUMBERS in '
  'yyx-server/data-pipeline/lib/recipe-metadata-schema.ts. Known gap: TM7 '
  'extended Celsius (125/135/145/155) and Fahrenheit (257-320) values are '
  'not yet in this enum; extend here first, then the schema.';
