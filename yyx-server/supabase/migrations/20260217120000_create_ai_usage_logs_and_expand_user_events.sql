-- Create AI usage logs for customer-facing AI cost tracking.
-- Includes text usage from chat/recipe generation and supports idempotent inserts.

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid,
  request_id text NOT NULL,
  call_phase text NOT NULL,
  attempt smallint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'error')),
  function_name text NOT NULL,
  usage_type text NOT NULL,
  model text,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric(10, 6),
  pricing_version smallint NOT NULL DEFAULT 1,
  duration_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_usage_logs_dedup
  ON public.ai_usage_logs(request_id, call_phase, attempt);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at
  ON public.ai_usage_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_created_at
  ON public.ai_usage_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_model_created_at
  ON public.ai_usage_logs(model, created_at DESC)
  WHERE model IS NOT NULL;

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Service-role-only access: no user policies added on purpose.

-- Expand analytics event allowlist while preserving existing reserved values.
ALTER TABLE public.user_events
  DROP CONSTRAINT IF EXISTS user_events_event_type_check;

ALTER TABLE public.user_events
  ADD CONSTRAINT user_events_event_type_check CHECK (
    event_type IN (
      'view_recipe',
      'cook_start',
      'cook_complete',
      'search',
      'rate_recipe',
      'save_recipe',
      'chat_message',
      'recipe_generate',
      'suggestion_click',
      'ai_chat_start',
      'ai_voice_start'
    )
  );
