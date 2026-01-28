-- Add missing trigger to automatically create user_profiles when auth.users are created
-- This trigger was missing from the schema, causing user profile creation to fail
-- When a new user signs up via auth, this trigger automatically creates their user_profile entry

-- Drop trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to call handle_new_user() on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
