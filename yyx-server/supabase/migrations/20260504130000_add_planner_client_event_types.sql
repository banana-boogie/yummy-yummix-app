-- Allow client-side analytics event types in user_events.
--
-- The previous expansion (20260427140032) added the server-emitted
-- meal_plan_* events but missed the planner_* events the app sends from
-- the menu screens, plus action_execute from the action registry. Inserts
-- for those types fail the CHECK and eventService swallows the error as a
-- console warning, so the events silently disappear from analytics.
--
-- Date: 2026-05-04
-- Depends on: 20260427140032_add_meal_plan_event_types.sql
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
            -- Server-side meal-planner loop (added 20260427140032):
            'meal_plan_meal_swapped',
            'meal_plan_skipped',
            'planned_meal_cook_completed',
            'meal_plan_approved',
            -- Client-side action and planner telemetry (this migration):
            'action_execute',
            'planner_today_view',
            'planner_cook_press',
            'planner_swap_press',
            'planner_swap_complete',
            'planner_week_link_press',
            'planner_mode_change',
            'planner_pull_to_refresh'
        )
    );
