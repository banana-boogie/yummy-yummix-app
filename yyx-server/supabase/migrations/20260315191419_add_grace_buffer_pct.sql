-- Add grace buffer percentage to AI membership tiers.
-- The grace buffer silently extends the hard limit so users are not
-- cut off at the exact boundary.  A value of 0.10 means 10% grace.

ALTER TABLE public.ai_membership_tiers
  ADD COLUMN IF NOT EXISTS grace_buffer_pct NUMERIC(5,4) NOT NULL DEFAULT 0.10;
