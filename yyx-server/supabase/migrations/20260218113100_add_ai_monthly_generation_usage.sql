-- Track monthly AI custom-recipe generation usage per user.

CREATE TABLE IF NOT EXISTS public.ai_monthly_generation_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_start DATE NOT NULL,
  generation_count INTEGER NOT NULL DEFAULT 0,
  warning_80_sent_at TIMESTAMPTZ NULL,
  warning_90_sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month_start)
);

CREATE INDEX IF NOT EXISTS idx_ai_monthly_generation_usage_month_start
  ON public.ai_monthly_generation_usage(month_start);

ALTER TABLE public.ai_monthly_generation_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own monthly generation usage"
  ON public.ai_monthly_generation_usage;
CREATE POLICY "Users can view own monthly generation usage"
  ON public.ai_monthly_generation_usage
  FOR SELECT
  USING (auth.uid() = user_id);
