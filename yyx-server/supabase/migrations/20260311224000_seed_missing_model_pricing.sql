-- Add pricing for new default-routed models.
-- Without these rows the gateway falls back to static pricing on every call.

INSERT INTO public.ai_model_pricing (model, input_price_per_million, output_price_per_million) VALUES
  ('gpt-4.1',                       2.00,  8.00),
  ('gemini-3-flash-preview',        0.50,  3.00),
  ('grok-4-1-fast-non-reasoning',   0.20,  0.50)
ON CONFLICT (model) DO UPDATE SET
  input_price_per_million = EXCLUDED.input_price_per_million,
  output_price_per_million = EXCLUDED.output_price_per_million,
  updated_at = now();
