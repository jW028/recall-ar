-- Postgres grants EXECUTE to PUBLIC on every new function, and PUBLIC includes anon. Revoking from
-- anon alone left that default grant in place, so both functions stayed callable without signing in.
-- Neither leaks anything (is_admin() returns false when auth.uid() is null, and
-- admin_auth_user_status() raises on a non-admin), but the grant should match the intent.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_auth_user_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_auth_user_status() TO authenticated;
