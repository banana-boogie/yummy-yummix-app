ALTER TABLE public.voice_quotas
  DROP CONSTRAINT IF EXISTS voice_quotas_monthly_minutes_limit_positive_check;

ALTER TABLE public.voice_quotas
  ADD CONSTRAINT voice_quotas_monthly_minutes_limit_positive_check
    CHECK (monthly_minutes_limit > 0);
