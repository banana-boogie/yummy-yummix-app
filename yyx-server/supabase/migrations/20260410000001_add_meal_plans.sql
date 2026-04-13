-- Migration: Add meal plans foundation tables and recipe metadata
-- PR #1: Track A foundation (schema + edge function scaffold)
-- Canonical schema: product-kitchen/repeat-what-works/design/meal-slot-schema.md
-- Date: 2026-04-10
-- Depends on: public.is_admin() (migration 20260202174533), public.update_updated_at_column() (migration 20260202174506)

-- ============================================================
-- 1. meal_plans — week-level container
-- ============================================================

CREATE TABLE public.meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    locale TEXT NOT NULL DEFAULT 'en',
    requested_day_indexes SMALLINT[] NOT NULL DEFAULT '{}',
    requested_meal_types TEXT[] NOT NULL DEFAULT '{}',
    shopping_list_id UUID,  -- FK to shopping_lists(id) added by Track B migration when shopping tables exist
    shopping_sync_state TEXT NOT NULL DEFAULT 'not_created',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT meal_plans_status_check CHECK (status IN ('draft', 'active', 'archived')),
    CONSTRAINT meal_plans_shopping_sync_check CHECK (shopping_sync_state IN ('not_created', 'current', 'stale', 'error')),
    CONSTRAINT meal_plans_day_indexes_range CHECK (requested_day_indexes <@ ARRAY[0,1,2,3,4,5,6]::smallint[]),
    CONSTRAINT meal_plans_requested_meal_types_check CHECK (
        requested_meal_types <@ ARRAY['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'beverage']::TEXT[]
    )
);

-- One active/draft plan per user per week
CREATE UNIQUE INDEX idx_meal_plans_active_week
    ON public.meal_plans (user_id, week_start)
    WHERE status IN ('draft', 'active');

CREATE INDEX idx_meal_plans_user_status ON public.meal_plans (user_id, status);
CREATE INDEX idx_meal_plans_shopping_list_id
    ON public.meal_plans (shopping_list_id)
    WHERE shopping_list_id IS NOT NULL;

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plans"
    ON public.meal_plans FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own plans"
    ON public.meal_plans FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own plans"
    ON public.meal_plans FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own plans"
    ON public.meal_plans FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.meal_plans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. meal_plan_slots — the scheduled meal event
-- ============================================================

CREATE TABLE public.meal_plan_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_id UUID NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
    planned_date DATE NOT NULL,
    day_index SMALLINT NOT NULL,
    meal_type TEXT NOT NULL,
    display_order SMALLINT NOT NULL DEFAULT 0,
    slot_type TEXT NOT NULL DEFAULT 'cook_slot',
    structure_template TEXT NOT NULL DEFAULT 'single_component',
    expected_food_groups TEXT[] NOT NULL DEFAULT '{}',
    selection_reason TEXT,
    shopping_sync_state TEXT NOT NULL DEFAULT 'not_created',
    status TEXT NOT NULL DEFAULT 'planned',
    swap_count SMALLINT NOT NULL DEFAULT 0,
    last_swapped_at TIMESTAMPTZ,
    cooked_at TIMESTAMPTZ,
    skipped_at TIMESTAMPTZ,
    merged_cooking_guide JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT slots_day_index_check CHECK (day_index BETWEEN 0 AND 6),
    CONSTRAINT slots_meal_type_check CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'beverage')),
    CONSTRAINT slots_slot_type_check CHECK (slot_type IN ('cook_slot', 'leftover_target_slot', 'no_cook_fallback_slot', 'weekend_flexible_slot')),
    CONSTRAINT slots_structure_check CHECK (structure_template IN ('single_component', 'main_plus_one_component', 'main_plus_two_components')),
    CONSTRAINT slots_expected_food_groups_check CHECK (
        expected_food_groups <@ ARRAY['protein', 'carb', 'veg', 'snack', 'dessert']::TEXT[]
    ),
    CONSTRAINT slots_shopping_sync_check CHECK (shopping_sync_state IN ('not_created', 'current', 'stale', 'error')),
    CONSTRAINT slots_status_check CHECK (status IN ('planned', 'cooked', 'skipped'))
);

CREATE UNIQUE INDEX idx_slots_unique
    ON public.meal_plan_slots (meal_plan_id, day_index, meal_type, display_order);

CREATE INDEX idx_slots_plan ON public.meal_plan_slots (meal_plan_id);

ALTER TABLE public.meal_plan_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own slots"
    ON public.meal_plan_slots FOR ALL TO authenticated
    USING (
        meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE user_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE user_id = (SELECT auth.uid())
        )
    );

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.meal_plan_slots
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. meal_plan_slot_components — recipe components within a slot
-- ============================================================

CREATE TABLE public.meal_plan_slot_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_slot_id UUID NOT NULL REFERENCES public.meal_plan_slots(id) ON DELETE CASCADE,
    component_role TEXT NOT NULL,
    source_kind TEXT NOT NULL DEFAULT 'recipe',
    recipe_id UUID REFERENCES public.recipes(id) ON DELETE RESTRICT,
    source_component_id UUID REFERENCES public.meal_plan_slot_components(id) ON DELETE RESTRICT,
    food_groups_snapshot TEXT[] NOT NULL DEFAULT '{}',
    pairing_basis TEXT NOT NULL DEFAULT 'standalone',
    display_order SMALLINT NOT NULL DEFAULT 0,
    title_snapshot TEXT NOT NULL,
    image_url_snapshot TEXT,
    total_time_snapshot INTEGER,
    difficulty_snapshot TEXT,
    portions_snapshot INTEGER,
    equipment_tags_snapshot TEXT[] NOT NULL DEFAULT '{}',
    selection_reason TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT components_role_check CHECK (component_role IN ('main', 'side', 'base', 'veg', 'snack', 'dessert', 'beverage', 'condiment', 'custom')),
    CONSTRAINT components_source_kind_check CHECK (source_kind IN ('recipe', 'leftover', 'no_cook', 'custom')),
    CONSTRAINT components_food_groups_snapshot_check CHECK (
        food_groups_snapshot <@ ARRAY['protein', 'carb', 'veg', 'snack', 'dessert']::TEXT[]
    ),
    CONSTRAINT components_pairing_basis_check CHECK (pairing_basis IN ('standalone', 'explicit_pairing', 'role_match', 'leftover_carry', 'manual')),
    CONSTRAINT components_difficulty_check CHECK (difficulty_snapshot IS NULL OR difficulty_snapshot IN ('easy', 'medium', 'hard')),
    CONSTRAINT components_source_lineage_check CHECK (
        (source_kind = 'recipe'
            AND recipe_id IS NOT NULL
            AND source_component_id IS NULL)
        OR (source_kind = 'leftover'
            AND source_component_id IS NOT NULL
            AND recipe_id IS NULL)
        OR (source_kind IN ('no_cook', 'custom')
            AND recipe_id IS NULL
            AND source_component_id IS NULL)
    )
);

CREATE UNIQUE INDEX idx_components_display_order
    ON public.meal_plan_slot_components (meal_plan_slot_id, display_order);

CREATE UNIQUE INDEX idx_components_one_primary
    ON public.meal_plan_slot_components (meal_plan_slot_id)
    WHERE is_primary = true;

CREATE INDEX idx_components_slot ON public.meal_plan_slot_components (meal_plan_slot_id);
CREATE INDEX idx_components_recipe ON public.meal_plan_slot_components (recipe_id) WHERE recipe_id IS NOT NULL;

ALTER TABLE public.meal_plan_slot_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own components"
    ON public.meal_plan_slot_components FOR ALL TO authenticated
    USING (
        meal_plan_slot_id IN (
            SELECT s.id FROM public.meal_plan_slots s
            JOIN public.meal_plans p ON s.meal_plan_id = p.id
            WHERE p.user_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        meal_plan_slot_id IN (
            SELECT s.id FROM public.meal_plan_slots s
            JOIN public.meal_plans p ON s.meal_plan_id = p.id
            WHERE p.user_id = (SELECT auth.uid())
        )
    );

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.meal_plan_slot_components
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. meal_plan_slot_rejections — tracks rejected swap candidates
-- ============================================================

CREATE TABLE public.meal_plan_slot_rejections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_slot_id UUID NOT NULL REFERENCES public.meal_plan_slots(id) ON DELETE CASCADE,
    component_role TEXT,
    recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    bundle_key TEXT,
    rejection_source TEXT NOT NULL,
    reason_code TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT rejections_component_role_check CHECK (component_role IS NULL OR component_role IN ('main', 'side', 'base', 'veg', 'snack', 'dessert', 'beverage', 'condiment', 'custom')),
    CONSTRAINT rejections_source_check CHECK (rejection_source IN ('user', 'system')),
    CONSTRAINT rejections_reason_check CHECK (reason_code IN ('user_swap', 'user_remove', 'bad_pairing', 'recently_cooked', 'insufficient_variety'))
);

CREATE INDEX idx_rejections_slot ON public.meal_plan_slot_rejections (meal_plan_slot_id);
CREATE INDEX idx_rejections_recipe ON public.meal_plan_slot_rejections (recipe_id);

ALTER TABLE public.meal_plan_slot_rejections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own rejections"
    ON public.meal_plan_slot_rejections FOR ALL TO authenticated
    USING (
        meal_plan_slot_id IN (
            SELECT s.id FROM public.meal_plan_slots s
            JOIN public.meal_plans p ON s.meal_plan_id = p.id
            WHERE p.user_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        meal_plan_slot_id IN (
            SELECT s.id FROM public.meal_plan_slots s
            JOIN public.meal_plans p ON s.meal_plan_id = p.id
            WHERE p.user_id = (SELECT auth.uid())
        )
    );

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.meal_plan_slot_rejections
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. meal_plan_feedback — post-week portion feedback
-- ============================================================

CREATE TABLE public.meal_plan_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_id UUID NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    overall_portion_feedback TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT feedback_portion_check CHECK (overall_portion_feedback IN ('too_little', 'just_right', 'too_much')),
    CONSTRAINT feedback_unique UNIQUE (meal_plan_id, user_id)
);

CREATE INDEX idx_feedback_plan ON public.meal_plan_feedback (meal_plan_id);

ALTER TABLE public.meal_plan_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own feedback"
    ON public.meal_plan_feedback FOR ALL TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND meal_plan_id IN (
            SELECT id FROM public.meal_plans WHERE user_id = (SELECT auth.uid())
        )
    );

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.meal_plan_feedback
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. meal_plan_feedback_flags — per-slot flags
-- ============================================================

CREATE TABLE public.meal_plan_feedback_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_feedback_id UUID NOT NULL REFERENCES public.meal_plan_feedback(id) ON DELETE CASCADE,
    meal_plan_slot_id UUID NOT NULL REFERENCES public.meal_plan_slots(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT flags_reason_check CHECK (reason IN ('not_enough_food', 'too_much_food', 'didnt_enjoy', 'too_much_work'))
);

CREATE INDEX idx_flags_feedback ON public.meal_plan_feedback_flags (meal_plan_feedback_id);
CREATE INDEX idx_flags_slot ON public.meal_plan_feedback_flags (meal_plan_slot_id);

ALTER TABLE public.meal_plan_feedback_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own feedback flags"
    ON public.meal_plan_feedback_flags FOR ALL TO authenticated
    USING (
        meal_plan_feedback_id IN (
            SELECT id FROM public.meal_plan_feedback WHERE user_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        meal_plan_feedback_id IN (
            SELECT id FROM public.meal_plan_feedback WHERE user_id = (SELECT auth.uid())
        )
        AND meal_plan_slot_id IN (
            SELECT s.id FROM public.meal_plan_slots s
            JOIN public.meal_plans p ON s.meal_plan_id = p.id
            WHERE p.user_id = (SELECT auth.uid())
        )
    );

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.meal_plan_feedback_flags
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 7. user_meal_planning_preferences
-- ============================================================

CREATE TABLE public.user_meal_planning_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    meal_types TEXT[] NOT NULL DEFAULT '{dinner}',
    busy_days SMALLINT[] NOT NULL DEFAULT '{}',
    active_day_indexes SMALLINT[] NOT NULL DEFAULT '{0,1,2,3,4}',
    default_max_weeknight_minutes INTEGER NOT NULL DEFAULT 45,
    prefer_leftovers_for_lunch BOOLEAN NOT NULL DEFAULT false,
    preferred_eat_times JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT prefs_user_unique UNIQUE (user_id),
    CONSTRAINT prefs_meal_types_check CHECK (
        meal_types <@ ARRAY['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'beverage']::TEXT[]
    ),
    CONSTRAINT prefs_busy_days_range CHECK (busy_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]),
    CONSTRAINT prefs_active_days_range CHECK (active_day_indexes <@ ARRAY[0,1,2,3,4,5,6]::smallint[]),
    CONSTRAINT prefs_default_max_weeknight_minutes_check CHECK (default_max_weeknight_minutes > 0)
);

ALTER TABLE public.user_meal_planning_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
    ON public.user_meal_planning_preferences FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own preferences"
    ON public.user_meal_planning_preferences FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own preferences"
    ON public.user_meal_planning_preferences FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.user_meal_planning_preferences
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 8. recipe_pairings — explicit recipe companions
-- ============================================================

CREATE TABLE public.recipe_pairings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    target_recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    pairing_role TEXT NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT pairings_role_check CHECK (pairing_role IN ('side', 'base', 'veg', 'dessert', 'beverage', 'condiment', 'leftover_transform')),
    CONSTRAINT pairings_no_self CHECK (source_recipe_id != target_recipe_id),
    CONSTRAINT pairings_unique UNIQUE (source_recipe_id, target_recipe_id, pairing_role)
);

CREATE INDEX idx_pairings_source ON public.recipe_pairings (source_recipe_id);
CREATE INDEX idx_pairings_target ON public.recipe_pairings (target_recipe_id);

ALTER TABLE public.recipe_pairings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read of published pairings"
    ON public.recipe_pairings FOR SELECT TO public
    USING (
        public.is_admin()
        OR (
            EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = source_recipe_id AND r.is_published = true)
            AND EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = target_recipe_id AND r.is_published = true)
        )
    );

CREATE POLICY "Admin write access"
    ON public.recipe_pairings FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.recipe_pairings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 9. user_implicit_preferences — silent taste learning
-- ============================================================

CREATE TABLE public.user_implicit_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dimension_type TEXT NOT NULL,
    dimension_key TEXT NOT NULL,
    preference_score NUMERIC NOT NULL DEFAULT 0,
    confidence_score NUMERIC NOT NULL DEFAULT 0,
    evidence_count INTEGER NOT NULL DEFAULT 0,
    last_signal_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT implicit_prefs_confidence_score_check CHECK (confidence_score >= 0 AND confidence_score <= 1),
    CONSTRAINT implicit_prefs_evidence_count_check CHECK (evidence_count >= 0),
    CONSTRAINT implicit_prefs_dimension_check CHECK (dimension_type IN ('ingredient', 'cuisine', 'protein_type', 'meal_type')),
    CONSTRAINT implicit_prefs_unique UNIQUE (user_id, dimension_type, dimension_key)
);

CREATE INDEX idx_implicit_prefs_user ON public.user_implicit_preferences (user_id);

ALTER TABLE public.user_implicit_preferences ENABLE ROW LEVEL SECURITY;

-- Writes are performed by server-side learning jobs via service_role (bypasses RLS).
-- End users are read-only on their own scores to prevent manipulation.
CREATE POLICY "Users can view own implicit preferences"
    ON public.user_implicit_preferences FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.user_implicit_preferences
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 10. user_day_patterns — silent slot learning
-- ============================================================

CREATE TABLE public.user_day_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    day_index SMALLINT NOT NULL,
    implicit_busy_score NUMERIC NOT NULL DEFAULT 0,
    swap_rate NUMERIC NOT NULL DEFAULT 0,
    skip_rate NUMERIC NOT NULL DEFAULT 0,
    completion_rate NUMERIC NOT NULL DEFAULT 0,
    evidence_weeks INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT day_patterns_day_check CHECK (day_index BETWEEN 0 AND 6),
    CONSTRAINT day_patterns_implicit_busy_score_check CHECK (implicit_busy_score >= 0 AND implicit_busy_score <= 1),
    CONSTRAINT day_patterns_swap_rate_check CHECK (swap_rate >= 0 AND swap_rate <= 1),
    CONSTRAINT day_patterns_skip_rate_check CHECK (skip_rate >= 0 AND skip_rate <= 1),
    CONSTRAINT day_patterns_completion_rate_check CHECK (completion_rate >= 0 AND completion_rate <= 1),
    CONSTRAINT day_patterns_evidence_weeks_check CHECK (evidence_weeks >= 0),
    CONSTRAINT day_patterns_unique UNIQUE (user_id, day_index)
);

CREATE INDEX idx_day_patterns_user ON public.user_day_patterns (user_id);

ALTER TABLE public.user_day_patterns ENABLE ROW LEVEL SECURITY;

-- Writes are performed by server-side learning jobs via service_role (bypasses RLS).
-- End users are read-only on their own patterns to prevent manipulation.
CREATE POLICY "Users can view own day patterns"
    ON public.user_day_patterns FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.user_day_patterns
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 11. Add planner metadata columns to recipes
-- ============================================================

ALTER TABLE public.recipes
    ADD COLUMN planner_role TEXT,
    ADD COLUMN food_groups TEXT[] DEFAULT '{}',
    ADD COLUMN is_complete_meal BOOLEAN DEFAULT false,
    ADD COLUMN equipment_tags TEXT[] DEFAULT '{}',
    ADD COLUMN cooking_level TEXT,
    ADD COLUMN leftovers_friendly BOOLEAN,
    ADD COLUMN max_household_size_supported INTEGER,
    ADD COLUMN batch_friendly BOOLEAN,
    ADD COLUMN requires_multi_batch_note TEXT,
    ADD COLUMN verified_at TIMESTAMPTZ,
    ADD COLUMN verified_by TEXT;

ALTER TABLE public.recipes
    ADD CONSTRAINT recipes_food_groups_check CHECK (
        food_groups <@ ARRAY['protein', 'carb', 'veg', 'snack', 'dessert']::TEXT[]
    ),
    ADD CONSTRAINT recipes_planner_role_check CHECK (planner_role IS NULL OR planner_role IN ('main', 'side', 'snack', 'dessert', 'beverage', 'condiment')),
    ADD CONSTRAINT recipes_cooking_level_check CHECK (cooking_level IS NULL OR cooking_level IN ('beginner', 'intermediate', 'experienced')),
    ADD CONSTRAINT recipes_max_household_size_supported_check CHECK (
        max_household_size_supported IS NULL OR max_household_size_supported > 0
    );

CREATE INDEX idx_recipes_planner_eligible
    ON public.recipes (planner_role, is_published)
    WHERE planner_role IS NOT NULL AND is_published = true;

-- ============================================================
-- 12. Add nutrition_goal to user_profiles
-- ============================================================

ALTER TABLE public.user_profiles
    ADD COLUMN nutrition_goal TEXT NOT NULL DEFAULT 'no_preference';

ALTER TABLE public.user_profiles
    ADD CONSTRAINT profiles_nutrition_goal_check CHECK (nutrition_goal IN ('no_preference', 'eat_healthier', 'lose_weight', 'more_protein', 'less_sugar'));
