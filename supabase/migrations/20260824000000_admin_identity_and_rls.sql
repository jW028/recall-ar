-- Admin identity, the RLS gaps that block it, and the audit log the dashboard writes to.
--
-- Every existing policy resolves auth.uid() to one caregiver or one paired patient, so there is no
-- cross-tenant read path at all. All 26 of them are PERMISSIVE, which means an additive
-- "FOR SELECT USING (public.is_admin())" per table ORs with what is already there: a non-admin's
-- access is byte-for-byte unchanged, and no existing policy has to be rewritten to make this work.

-- ── 1. Security fixes that must land before admin policies go on ──

-- PatientLocation had RLS switched off entirely, so both of its policies were inert and anyone with
-- the publishable key could read every patient's GPS trail. Its INSERT check was also wrong:
-- "auth.uid() = patient_id" compares a patient's auth user id against their Patient PK, which are
-- different uuids (they are linked via Patient.auth_user_id). Enabling RLS over that predicate would
-- have broken LocationService.publishLocation on every patient device.
DROP POLICY IF EXISTS "Patient inserts own location" ON public."PatientLocation";
DROP POLICY IF EXISTS "Caregiver reads patient location" ON public."PatientLocation";

-- FOR ALL, not FOR INSERT: (patient)/index.tsx also calls pruneOldLocations, which selects and deletes.
CREATE POLICY "PatientLocation: patient self"
  ON public."PatientLocation"
  FOR ALL
  TO authenticated
  USING (
    patient_id IN (
      SELECT "Patient".patient_id FROM public."Patient"
      WHERE "Patient".auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    patient_id IN (
      SELECT "Patient".patient_id FROM public."Patient"
      WHERE "Patient".auth_user_id = auth.uid()
    )
  );

CREATE POLICY "PatientLocation: caregiver owns patient"
  ON public."PatientLocation"
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT "Patient".patient_id FROM public."Patient"
      WHERE "Patient".caregiver_id = auth.uid()
    )
  );

ALTER TABLE public."PatientLocation" ENABLE ROW LEVEL SECURITY;

-- CaregiverPushToken had RLS off and zero policies, exposing every caregiver's Expo push token.
-- caregiver_id = auth.uid() is valid here because the handle_new_caregiver trigger sets
-- Caregiver.caregiver_id to the auth user's id.
CREATE POLICY "CaregiverPushToken: own row only"
  ON public."CaregiverPushToken"
  FOR ALL
  TO authenticated
  USING (caregiver_id = auth.uid())
  WITH CHECK (caregiver_id = auth.uid());

ALTER TABLE public."CaregiverPushToken" ENABLE ROW LEVEL SECURITY;

-- "GeofenceEvent: allow authenticated" was USING (true) WITH CHECK (true) — every authenticated user
-- could read and write every geofence event on the platform. GeofenceEvent has no patient_id, so
-- ownership resolves through geofence_id -> Geofence.patient_id. Both device roles write these rows:
-- the patient device via publishLocation and the caregiver device via fetchLatestLocation, both of
-- which call GeofenceService.evaluatePatientLocationAndRecordEvents.
DROP POLICY IF EXISTS "GeofenceEvent: allow authenticated" ON public."GeofenceEvent";

CREATE POLICY "GeofenceEvent: caregiver owns patient"
  ON public."GeofenceEvent"
  FOR ALL
  TO authenticated
  USING (
    geofence_id IN (
      SELECT g.geofence_id FROM public."Geofence" g
      JOIN public."Patient" p ON p.patient_id = g.patient_id
      WHERE p.caregiver_id = auth.uid()
    )
  )
  WITH CHECK (
    geofence_id IN (
      SELECT g.geofence_id FROM public."Geofence" g
      JOIN public."Patient" p ON p.patient_id = g.patient_id
      WHERE p.caregiver_id = auth.uid()
    )
  );

CREATE POLICY "GeofenceEvent: patient self"
  ON public."GeofenceEvent"
  FOR ALL
  TO authenticated
  USING (
    geofence_id IN (
      SELECT g.geofence_id FROM public."Geofence" g
      JOIN public."Patient" p ON p.patient_id = g.patient_id
      WHERE p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    geofence_id IN (
      SELECT g.geofence_id FROM public."Geofence" g
      JOIN public."Patient" p ON p.patient_id = g.patient_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

-- ── 2. Admin identity ──

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER so the function reads admin_users directly instead of recursing through the RLS
-- policy on admin_users, which itself calls is_admin(). search_path is pinned per Supabase guidance.
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE POLICY "admin_users: admin read"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ── 3. Additive admin read policies, one per table ──

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Caregiver', 'Patient', 'MemoryAsset', 'TrainingSession', 'DailyReviewEntry',
    'CognitiveReport', 'Geofence', 'GeofenceEvent', 'Threat', 'ContextAlert',
    'DevicePairing', 'PatientLocation', 'CaregiverPushToken', 'RecognitionEvent', 'Encouragement'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_admin())',
      t || ': admin read', t
    );
  END LOOP;
END $$;

-- ── 4. Audit log ──

-- No INSERT policy by design: only the service-role admin-actions edge function writes here, so an
-- admin cannot forge or suppress an entry from the browser even though they can read every row.
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id            bigserial PRIMARY KEY,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  action        text NOT NULL,
  target_type   text NOT NULL,
  target_id     text,
  succeeded     boolean NOT NULL DEFAULT true,
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_audit_log: admin read"
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log (created_at DESC);

-- ── 5. Indexes for the dashboard's query shapes ──

-- TrainingSession has no patient_id, so every performance rollup joins through MemoryAsset.
-- idx_session_asset(asset_id, timestamp) already covers the session side; these cover the rest.
CREATE INDEX IF NOT EXISTS idx_patient_caregiver     ON public."Patient" (caregiver_id);
CREATE INDEX IF NOT EXISTS idx_review_patient        ON public."DailyReviewEntry" (patient_id);
CREATE INDEX IF NOT EXISTS idx_threat_patient_time   ON public."Threat" (patient_id, detected_time DESC);
CREATE INDEX IF NOT EXISTS idx_ctxalert_patient_time ON public."ContextAlert" (patient_id, ctxalert_time DESC);
CREATE INDEX IF NOT EXISTS idx_pairing_caregiver     ON public."DevicePairing" (caregiver_id, created_at DESC);
