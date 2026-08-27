-- Supabase grants EXECUTE to anon and authenticated explicitly on every new function in public, so
-- REVOKE ... FROM PUBLIC does not close the door on its own.

-- A trigger function has no business being reachable at /rest/v1/rpc. Postgres does not check EXECUTE
-- on a trigger function when the trigger fires, so revoking this does not affect message inserts.
REVOKE EXECUTE ON FUNCTION public.support_message_after_insert() FROM PUBLIC, anon, authenticated;

-- Admin-only: the function raises for a non-admin anyway, but anon should not be able to reach it.
REVOKE EXECUTE ON FUNCTION public.admin_mark_ticket_read(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_mark_ticket_read(uuid) TO authenticated;
