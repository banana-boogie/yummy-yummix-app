-- Extend the user_events event_type check constraint to allow
-- 'irmixy_home_action_tapped'. Emitted when a user taps a card in the
-- Irmixy chat empty-state action grid (Track D / PR #45). The 'irmixy_'
-- prefix groups all Irmixy-surface events for filtering.

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
      'ai_voice_start',
      'irmixy_home_action_tapped'
    )
  );
