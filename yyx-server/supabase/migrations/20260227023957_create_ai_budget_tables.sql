-- Cost-based AI budget system.
-- Replaces the old count-based generation budget with cost-aware tracking
-- tied to membership tiers.

-- ============================================================
-- 1. New tables
-- ============================================================

-- Per-model cost rates (source of truth for pricing)
CREATE TABLE public.ai_model_pricing (
  model TEXT PRIMARY KEY,
  input_price_per_million NUMERIC(10,6) NOT NULL,
  output_price_per_million NUMERIC(10,6) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS — read by service role only
ALTER TABLE public.ai_model_pricing ENABLE ROW LEVEL SECURITY;

-- Budget limits per membership tier
CREATE TABLE public.ai_membership_tiers (
  tier TEXT PRIMARY KEY,
  monthly_text_budget_usd NUMERIC(10,6) NOT NULL,
  monthly_voice_minutes INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_membership_tiers ENABLE ROW LEVEL SECURITY;

-- Per-AI-call detail log
CREATE TABLE public.ai_cost_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  usage_type TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  edge_function TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_cost_log_user_created
  ON public.ai_cost_log(user_id, created_at);

ALTER TABLE public.ai_cost_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own cost log
CREATE POLICY "Users can view own cost log"
  ON public.ai_cost_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role inserts (no user insert policy)

-- Monthly aggregate per user
CREATE TABLE public.ai_budget_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  total_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  total_input_tokens BIGINT NOT NULL DEFAULT 0,
  total_output_tokens BIGINT NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

ALTER TABLE public.ai_budget_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own budget usage
CREATE POLICY "Users can view own budget usage"
  ON public.ai_budget_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. Trigger: auto-aggregate cost log into budget usage
-- ============================================================

CREATE OR REPLACE FUNCTION public.aggregate_ai_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_budget_usage (user_id, month, total_cost_usd, total_input_tokens, total_output_tokens, request_count, updated_at)
  VALUES (
    NEW.user_id,
    to_char(NEW.created_at, 'YYYY-MM'),
    NEW.cost_usd,
    NEW.input_tokens,
    NEW.output_tokens,
    1,
    now()
  )
  ON CONFLICT (user_id, month) DO UPDATE SET
    total_cost_usd = ai_budget_usage.total_cost_usd + EXCLUDED.total_cost_usd,
    total_input_tokens = ai_budget_usage.total_input_tokens + EXCLUDED.total_input_tokens,
    total_output_tokens = ai_budget_usage.total_output_tokens + EXCLUDED.total_output_tokens,
    request_count = ai_budget_usage.request_count + 1,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_aggregate_ai_cost
  AFTER INSERT ON public.ai_cost_log
  FOR EACH ROW
  EXECUTE FUNCTION public.aggregate_ai_cost();

-- ============================================================
-- 3. Add membership_tier to user_profiles
-- ============================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS membership_tier TEXT NOT NULL DEFAULT 'free'
  CHECK (membership_tier IN ('free', 'premium'));

-- ============================================================
-- 4. Seed data
-- ============================================================

INSERT INTO public.ai_model_pricing (model, input_price_per_million, output_price_per_million) VALUES
  ('gemini-2.5-flash', 0.15, 0.60),
  ('gpt-4.1-nano', 0.10, 0.40),
  ('gpt-4.1-mini', 0.40, 1.60),
  ('text-embedding-3-large', 0.13, 0.00)
ON CONFLICT (model) DO UPDATE SET
  input_price_per_million = EXCLUDED.input_price_per_million,
  output_price_per_million = EXCLUDED.output_price_per_million,
  updated_at = now();

INSERT INTO public.ai_membership_tiers (tier, monthly_text_budget_usd, monthly_voice_minutes) VALUES
  ('free', 0.10, 5),
  ('premium', 2.00, 30)
ON CONFLICT (tier) DO UPDATE SET
  monthly_text_budget_usd = EXCLUDED.monthly_text_budget_usd,
  monthly_voice_minutes = EXCLUDED.monthly_voice_minutes,
  updated_at = now();

-- ============================================================
-- 5. Drop old unused budget/rate-limit infrastructure
-- ============================================================

-- Drop the old atomic budget function
DROP FUNCTION IF EXISTS public.check_and_increment_ai_generation_usage(UUID, INTEGER);

-- Drop the old rate-limit function
DROP FUNCTION IF EXISTS public.check_and_increment_ai_chat_rate_limit(UUID, INTEGER, INTEGER);

-- Drop old tables
DROP TABLE IF EXISTS public.ai_monthly_generation_usage;
DROP TABLE IF EXISTS public.ai_chat_rate_limits;
