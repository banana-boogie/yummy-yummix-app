-- Expand user_events.event_type allowlist for Plan 06 planner/shopping/explore/chat events.
-- Previous CHECK constraint only included a legacy set of event names; new Plan 06 event
-- names (e.g. meal_plan_generated, recipe_rated, shopping_list_generated_from_plan) were
-- rejected, which failed the whole batched insert in eventService.flush() and caused the
-- queue to requeue indefinitely. This migration preserves every legacy value and adds the
-- full current EventPayloadMap surface.
--
-- Source of truth for the event set: yyx-app/services/analytics/eventTypes.ts
-- and product-kitchen/repeat-what-works/plans/06-analytics-and-metrics.md.

ALTER TABLE public.user_events
  DROP CONSTRAINT IF EXISTS user_events_event_type_check;

ALTER TABLE public.user_events
  ADD CONSTRAINT user_events_event_type_check CHECK (
    event_type IN (
      -- Legacy events (preserved from previous migration) -----------------
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
      -- Legacy action execute (pre-dates EventPayloadMap, already emitted) -
      'action_execute',
      -- Plan 06: Planner funnel ------------------------------------------
      'week_tab_viewed',
      'planner_setup_started',
      'planner_setup_completed',
      'meal_plan_generation_started',
      'meal_plan_generated',
      'meal_plan_generation_failed',
      'meal_plan_viewed',
      'meal_plan_approved',
      'meal_plan_meal_swapped',
      'meal_plan_swap_failed',
      'meal_plan_skipped',
      'meal_plan_skip_suggestion_shown',
      'meal_plan_skip_suggestion_accepted',
      'meal_plan_skip_suggestion_dismissed',
      -- Plan 06: Shopping funnel -----------------------------------------
      'shopping_list_generation_started',
      'shopping_list_generated_from_plan',
      'shopping_list_generation_failed',
      'shopping_list_opened',
      'shopping_list_refreshed_from_plan',
      -- Plan 06: Cooking / ratings ---------------------------------------
      'planned_meal_cook_started',
      'planned_meal_cook_completed',
      'recipe_rated',
      'recipe_difficulty_flagged_for_review',
      'recipe_difficulty_override_applied',
      -- Plan 06: Entry / discovery ---------------------------------------
      'chat_home_action_tapped',
      'explore_section_viewed',
      'explore_recipe_opened',
      'explore_filter_applied',
      'explore_add_to_plan'
    )
  );
