-- Shopping list feature: categories, lists, items, pantry, favorites, purchase history.
-- Ported from legacy feature/shopping-list branch (was yyx-server/db/migrations/011).

CREATE TABLE shopping_list_categories (
    id TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_es TEXT NOT NULL,
    icon TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shopping_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shopping_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
    category_id TEXT NOT NULL REFERENCES shopping_list_categories(id) DEFAULT 'other',
    name_custom TEXT,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit_id TEXT REFERENCES measurement_units(id),
    notes TEXT,
    is_checked BOOLEAN NOT NULL DEFAULT FALSE,
    checked_at TIMESTAMPTZ,
    recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT item_has_name CHECK (ingredient_id IS NOT NULL OR name_custom IS NOT NULL)
);

CREATE TABLE user_category_order (
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES shopping_list_categories(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL,
    PRIMARY KEY (user_id, category_id)
);

CREATE TABLE pantry_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
    category_id TEXT NOT NULL REFERENCES shopping_list_categories(id),
    name_custom TEXT,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit_id TEXT REFERENCES measurement_units(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE favorite_shopping_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
    category_id TEXT NOT NULL REFERENCES shopping_list_categories(id),
    name_custom TEXT,
    default_quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    default_unit_id TEXT REFERENCES measurement_units(id),
    purchase_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
    category_id TEXT NOT NULL REFERENCES shopping_list_categories(id),
    name_custom TEXT,
    quantity NUMERIC(10, 2) NOT NULL,
    unit_id TEXT REFERENCES measurement_units(id),
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
    shopping_list_id UUID REFERENCES shopping_lists(id) ON DELETE SET NULL
);

ALTER TABLE shopping_list_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are viewable by everyone" ON shopping_list_categories FOR SELECT USING (true);

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own shopping lists" ON shopping_lists
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own shopping list items" ON shopping_list_items
    FOR ALL
    USING (EXISTS (SELECT 1 FROM shopping_lists WHERE id = shopping_list_items.shopping_list_id AND user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM shopping_lists WHERE id = shopping_list_items.shopping_list_id AND user_id = auth.uid()));

ALTER TABLE user_category_order ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own category order" ON user_category_order FOR ALL USING (auth.uid() = user_id);

ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own pantry" ON pantry_items FOR ALL USING (auth.uid() = user_id);

ALTER TABLE favorite_shopping_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own favorites" ON favorite_shopping_items FOR ALL USING (auth.uid() = user_id);

ALTER TABLE purchase_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own purchase history" ON purchase_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own purchase history" ON purchase_history FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_shopping_lists_user ON shopping_lists(user_id);
CREATE INDEX idx_shopping_list_items_list ON shopping_list_items(shopping_list_id);
CREATE INDEX idx_shopping_list_items_ingredient ON shopping_list_items(ingredient_id);
CREATE INDEX idx_pantry_user ON pantry_items(user_id);
CREATE INDEX idx_favorites_user ON favorite_shopping_items(user_id);
CREATE INDEX idx_purchase_history_user ON purchase_history(user_id);

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shopping_lists_modtime BEFORE UPDATE ON shopping_lists FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_shopping_list_items_modtime BEFORE UPDATE ON shopping_list_items FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_pantry_items_modtime BEFORE UPDATE ON pantry_items FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_favorites_modtime BEFORE UPDATE ON favorite_shopping_items FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE OR REPLACE FUNCTION record_purchase_on_check()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_checked = TRUE AND OLD.is_checked = FALSE THEN
        NEW.checked_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_shopping_item_checked_at
    BEFORE UPDATE ON shopping_list_items
    FOR EACH ROW
    EXECUTE PROCEDURE record_purchase_on_check();

INSERT INTO shopping_list_categories (id, name_en, name_es, icon, display_order) VALUES
('produce', 'Produce', 'Frutas y Verduras', 'leaf-outline', 1),
('dairy', 'Dairy & Eggs', 'Lácteos y Huevos', 'egg-outline', 2),
('meat', 'Meat & Seafood', 'Carnes y Mariscos', 'fish-outline', 3),
('bakery', 'Bakery', 'Panadería', 'cafe-outline', 4),
('pantry', 'Pantry Staples', 'Despensa', 'file-tray-full-outline', 5),
('frozen', 'Frozen', 'Congelados', 'snow-outline', 6),
('beverages', 'Beverages', 'Bebidas', 'wine-outline', 7),
('snacks', 'Snacks', 'Botanas', 'pizza-outline', 8),
('spices', 'Spices & Condiments', 'Especias y Condimentos', 'flask-outline', 9),
('household', 'Household', 'Hogar', 'home-outline', 10),
('personal', 'Personal Care', 'Cuidado Personal', 'heart-outline', 11),
('other', 'Other', 'Otros', 'ellipsis-horizontal-outline', 12);

-- Attach the shopping_list_id FK now that shopping_lists exists (set up nullable in planner migration).
-- Guarded so the migration is idempotent — Track A or a prior partial run may have already added it.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'meal_plans_shopping_list_id_fkey'
    ) THEN
        ALTER TABLE public.meal_plans
            ADD CONSTRAINT meal_plans_shopping_list_id_fkey
            FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists(id) ON DELETE SET NULL;
    END IF;
END $$;
