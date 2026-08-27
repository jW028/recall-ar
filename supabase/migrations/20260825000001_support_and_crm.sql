-- Two-sided support channel plus a light CRM layer on caregiver accounts.
--
-- Tables the mobile app reads are PascalCase like every other app table; admin-only tables are
-- snake_case like admin_users and admin_audit_log.
--
-- Support data deliberately does NOT go through the SQLite sync queue. SyncService.pullAllForCaregiver
-- uses caregiver_id as a scope column in exactly one hardcoded place (the Patient table); a
-- caregiver-keyed table would push up and never pull replies back down. It follows the direct-to-
-- Supabase precedent already set by PatientLocation, DevicePairing, CaregiverPushToken and Caregiver.

-- ── Tables ──

CREATE TABLE IF NOT EXISTS public."SupportTicket" (
  ticket_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id           uuid NOT NULL REFERENCES public."Caregiver"(caregiver_id) ON DELETE CASCADE,
  subject                text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 120),
  status                 text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  diagnostics            jsonb NOT NULL DEFAULT '{}'::jsonb,
  caregiver_last_read_at timestamptz,
  last_message_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at            timestamptz,
  resolved_by            uuid REFERENCES auth.users(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."SupportMessage" (
  message_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id      uuid NOT NULL REFERENCES public."SupportTicket"(ticket_id) ON DELETE CASCADE,
  author_role    text NOT NULL CHECK (author_role IN ('caregiver', 'admin')),
  author_user_id uuid NOT NULL REFERENCES auth.users(id),
  body           text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Admin read state lives in its own table rather than a column on SupportTicket. Column-level UPDATE
-- grants are role-wide and admins are also 'authenticated', so a grant narrow enough to stop a
-- caregiver editing status would equally stop an admin. Splitting the two cursors avoids the collision.
CREATE TABLE IF NOT EXISTS public.support_ticket_admin_state (
  ticket_id          uuid PRIMARY KEY REFERENCES public."SupportTicket"(ticket_id) ON DELETE CASCADE,
  admin_last_read_at timestamptz,
  assigned_to        uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.caregiver_note (
  note_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id   uuid NOT NULL REFERENCES public."Caregiver"(caregiver_id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users(id),
  body           text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.caregiver_tag (
  caregiver_id uuid NOT NULL REFERENCES public."Caregiver"(caregiver_id) ON DELETE CASCADE,
  tag          text NOT NULL CHECK (char_length(tag) BETWEEN 1 AND 32),
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (caregiver_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_ticket_caregiver   ON public."SupportTicket" (caregiver_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_status      ON public."SupportTicket" (status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_ticket     ON public."SupportMessage" (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_note_caregiver     ON public.caregiver_note (caregiver_id, created_at DESC);

-- ── Triggers ──

CREATE TRIGGER trg_support_ticket_updated_at
  BEFORE UPDATE ON public."SupportTicket"
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Keeps last_message_at current for queue ordering, and reopens a resolved ticket when the caregiver
-- writes back. A reply to a closed ticket should reopen the conversation, not disappear into it.
CREATE OR REPLACE FUNCTION public.support_message_after_insert()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE public."SupportTicket"
  SET last_message_at = NEW.created_at,
      status      = CASE WHEN NEW.author_role = 'caregiver' THEN 'open' ELSE status END,
      resolved_at = CASE WHEN NEW.author_role = 'caregiver' THEN NULL ELSE resolved_at END,
      resolved_by = CASE WHEN NEW.author_role = 'caregiver' THEN NULL ELSE resolved_by END
  WHERE ticket_id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

-- SECURITY DEFINER because the caregiver posting the message has no UPDATE privilege on these columns.
CREATE TRIGGER trg_support_message_after_insert
  AFTER INSERT ON public."SupportMessage"
  FOR EACH ROW EXECUTE FUNCTION public.support_message_after_insert();

-- ── RLS ──

ALTER TABLE public."SupportTicket"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SupportMessage"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_admin_state  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caregiver_note              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caregiver_tag               ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SupportTicket: caregiver owns" ON public."SupportTicket"
  FOR SELECT TO authenticated USING (caregiver_id = auth.uid());

CREATE POLICY "SupportTicket: caregiver creates" ON public."SupportTicket"
  FOR INSERT TO authenticated WITH CHECK (caregiver_id = auth.uid());

-- The read cursor is the only column a caregiver may move, enforced by the column grant below rather
-- than by this policy: RLS cannot restrict columns.
CREATE POLICY "SupportTicket: caregiver marks read" ON public."SupportTicket"
  FOR UPDATE TO authenticated
  USING (caregiver_id = auth.uid())
  WITH CHECK (caregiver_id = auth.uid());

CREATE POLICY "SupportTicket: admin read" ON public."SupportTicket"
  FOR SELECT TO authenticated USING (public.is_admin());

REVOKE UPDATE ON public."SupportTicket" FROM authenticated;
GRANT  UPDATE (caregiver_last_read_at) ON public."SupportTicket" TO authenticated;

CREATE POLICY "SupportMessage: caregiver reads own thread" ON public."SupportMessage"
  FOR SELECT TO authenticated
  USING (ticket_id IN (SELECT t.ticket_id FROM public."SupportTicket" t WHERE t.caregiver_id = auth.uid()));

-- author_role is pinned so a caregiver cannot forge a message that renders as coming from support.
CREATE POLICY "SupportMessage: caregiver writes own thread" ON public."SupportMessage"
  FOR INSERT TO authenticated
  WITH CHECK (
    author_role = 'caregiver'
    AND author_user_id = auth.uid()
    AND ticket_id IN (SELECT t.ticket_id FROM public."SupportTicket" t WHERE t.caregiver_id = auth.uid())
  );

CREATE POLICY "SupportMessage: admin read" ON public."SupportMessage"
  FOR SELECT TO authenticated USING (public.is_admin());

-- Admin-only tables. A caregiver has no policy here at all, so internal notes are not merely hidden
-- from the UI — the rows do not exist as far as their session is concerned.
CREATE POLICY "support_ticket_admin_state: admin only" ON public.support_ticket_admin_state
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "caregiver_note: admin only" ON public.caregiver_note
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "caregiver_tag: admin only" ON public.caregiver_tag
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── Admin read model ──

CREATE OR REPLACE VIEW public.admin_support_overview WITH (security_invoker = true) AS
SELECT
  t.ticket_id,
  t.caregiver_id,
  c.full_name  AS caregiver_name,
  c.email      AS caregiver_email,
  t.subject,
  t.status,
  t.diagnostics,
  t.created_at,
  t.last_message_at,
  t.resolved_at,
  s.admin_last_read_at,
  s.assigned_to,
  (SELECT count(*) FROM public."SupportMessage" m WHERE m.ticket_id = t.ticket_id) AS message_count,
  (SELECT m.author_role FROM public."SupportMessage" m
    WHERE m.ticket_id = t.ticket_id ORDER BY m.created_at DESC LIMIT 1) AS last_author_role,
  -- Unread means the caregiver spoke last and no admin has looked since. An admin's own reply
  -- must never leave the ticket looking unread.
  (
    (SELECT m.author_role FROM public."SupportMessage" m
      WHERE m.ticket_id = t.ticket_id ORDER BY m.created_at DESC LIMIT 1) = 'caregiver'
    AND t.last_message_at > coalesce(s.admin_last_read_at, '-infinity'::timestamptz)
  ) AS has_unread
FROM public."SupportTicket" t
JOIN public."Caregiver" c ON c.caregiver_id = t.caregiver_id
LEFT JOIN public.support_ticket_admin_state s ON s.ticket_id = t.ticket_id
WHERE public.is_admin();

REVOKE ALL ON public.admin_support_overview FROM anon;
GRANT SELECT ON public.admin_support_overview TO authenticated;

-- Surfaces open ticket count alongside the rest of a caregiver's numbers in the Users table.
CREATE OR REPLACE VIEW public.admin_caregiver_overview WITH (security_invoker = true) AS
SELECT c.caregiver_id, c.full_name, c.email, c.caregiver_contact, c.image_url, c.created_at,
  count(DISTINCT p.patient_id) AS patient_count,
  count(DISTINCT p.patient_id) FILTER (WHERE p.auth_user_id IS NOT NULL) AS paired_patient_count,
  count(DISTINCT ma.asset_id) AS asset_count,
  count(ts.session_id) AS session_count,
  max(ts.timestamp) AS last_session_at,
  (SELECT count(*) FROM public."SupportTicket" t
    WHERE t.caregiver_id = c.caregiver_id AND t.status = 'open') AS open_ticket_count
FROM public."Caregiver" c
LEFT JOIN public."Patient" p ON p.caregiver_id = c.caregiver_id
LEFT JOIN public."MemoryAsset" ma ON ma.patient_id = p.patient_id
LEFT JOIN public."TrainingSession" ts ON ts.asset_id = ma.asset_id
WHERE public.is_admin()
GROUP BY c.caregiver_id, c.full_name, c.email, c.caregiver_contact, c.image_url, c.created_at;

-- ── Read cursor ──

-- Marks a ticket read using the database clock rather than the caller's.
--
-- The dashboard would otherwise send new Date() from the browser and the edge function from Deno,
-- while message timestamps come from Postgres. Three clocks deciding whether a caregiver's reply is
-- "newer than" the admin's read cursor means a few seconds of skew can silently mark an unanswered
-- message as read and drop it out of the queue — the worst failure mode a support inbox has.
CREATE OR REPLACE FUNCTION public.admin_mark_ticket_read(p_ticket_id uuid)
  RETURNS timestamptz
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  stamped timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  INSERT INTO public.support_ticket_admin_state (ticket_id, admin_last_read_at)
  VALUES (p_ticket_id, now())
  ON CONFLICT (ticket_id) DO UPDATE SET admin_last_read_at = now()
  RETURNING admin_last_read_at INTO stamped;
  RETURN stamped;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_mark_ticket_read(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_mark_ticket_read(uuid) TO authenticated;
