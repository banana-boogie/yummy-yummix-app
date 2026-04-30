-- Migration: Allow meal-plan analytics events in user_events
--
-- The meal-planner edge function logs four new event types for the
-- swap/skip/cook/approve loop. The existing CHECK constraint on
-- `user_events.event_type` predates these handlers; without expanding the
-- allowlist, inserts fail with a constraint violation that `logUserEvent`
-- swallows as a console warning, so the events silently disappear.
--
-- Adding these event types lets cohort dashboards (concierge launch +
-- engagement metrics) see the full meal-planner funnel.
--
-- Date: 2026-04-27
-- Depends on: 20260303034648_create_ai_usage_logs_and_expand_user_events.sql
--             (last definition of user_events_event_type_check)

ALTER TABLE public.user_events
    DROP CONSTRAINT IF EXISTS user_events_event_type_check;

ALTER TABLE public.user_events
    ADD CONSTRAINT user_events_event_type_check CHECK (
        event_type IN (
            -- Original allowlist (preserved):
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
            -- Meal-planner loop (added in PR #2.5):
            'meal_plan_meal_swapped',
            'meal_plan_skipped',
            'planned_meal_cook_completed',
            'meal_plan_approved'
        )
    );
