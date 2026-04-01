-- Add "scoop" measurement unit (universal, e.g. protein powder)
INSERT INTO measurement_units (id, type, system)
VALUES ('scoop', 'unit', 'universal')
ON CONFLICT (id) DO NOTHING;

INSERT INTO measurement_unit_translations (measurement_unit_id, locale, name, name_plural, symbol, symbol_plural)
VALUES
  ('scoop', 'en', 'scoop', 'scoops', 'scoop', 'scoops'),
  ('scoop', 'es', 'scoop', 'scoops', 'scoop', 'scoops')
ON CONFLICT (measurement_unit_id, locale) DO NOTHING;
