-- Allow admins to read all user recipes (for admin analytics detail pages)
DROP POLICY IF EXISTS "admin_read_user_recipes" ON public.user_recipes;
CREATE POLICY "admin_read_user_recipes"
  ON public.user_recipes FOR SELECT TO authenticated
  USING (public.is_admin());

-- Allow admins to read all user profiles (for admin analytics detail pages)
DROP POLICY IF EXISTS "admin_read_user_profiles" ON public.user_profiles;
CREATE POLICY "admin_read_user_profiles"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (public.is_admin());
