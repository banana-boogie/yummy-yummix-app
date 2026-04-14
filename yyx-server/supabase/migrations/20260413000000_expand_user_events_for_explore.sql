-- Migration: Expand user_events allowlist for Explore-page analytics
-- Track E: adds explore_section_viewed, explore_filter_applied, explore_add_to_plan
-- Date: 2026-04-13

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
      'action_execute',
      'explore_section_viewed',
      'explore_filter_applied',
      'explore_add_to_plan'
    )
  );
