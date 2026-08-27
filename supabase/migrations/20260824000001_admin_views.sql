-- Read models for the admin dashboard.
--
-- Every view is security_invoker so the "<T>: admin read" policies from the previous migration do the
-- gating: a caregiver selecting from these gets their own rows filtered by their own policies, never
-- anyone else's. The redundant "WHERE public.is_admin()" on top makes that uniform — a non-admin gets
-- zero rows rather than a partial self-scoped aggregate, so an authorization bug shows up as an empty
-- dashboard instead of a plausible-looking wrong number.
--
-- Day bucketing is "AT TIME ZONE 'utc'" throughout to match AnalyticsService, which buckets by slicing
-- the first 10 characters off an ISO-8601 Z timestamp. A bare ::date cast would follow the session
-- TimeZone instead and silently disagree with the caregiver's own analytics screen.
--
-- MemoryAsset columns are always enumerated, never SELECT *: its embedding column is a 512- or
-- 1280-dimension pgvector and must not be dragged across the wire.

-- ── Platform totals ──

CREATE OR REPLACE VIEW public.admin_kpi WITH (security_invoker = true) AS
SELECT
  (SELECT count(*) FROM public."Caregiver")                                          AS caregivers,
  (SELECT count(*) FROM public."Patient")                                            AS patients,
  (SELECT count(*) FROM public."Patient" WHERE auth_user_id IS NOT NULL)             AS paired_patients,
  (SELECT count(*) FROM public."MemoryAsset")                                        AS assets,
  (SELECT count(*) FROM public."TrainingSession")                                    AS sessions,
  (SELECT count(*) FROM public."RecognitionEvent")                                   AS recognitions,
  (SELECT count(*) FROM public."Threat" WHERE acknowledged_time IS NULL)             AS open_threats,
  (SELECT count(*) FROM public."ContextAlert" WHERE ack_time IS NULL)                AS open_context_alerts,
  (SELECT count(*) FROM public."CognitiveReport")                                    AS reports_generated
FROM (SELECT 1) AS one
WHERE public.is_admin();

-- ── Growth: one row per day for the last 180 days, zero-filled ──

CREATE OR REPLACE VIEW public.admin_growth_daily WITH (security_invoker = true) AS
WITH days AS (
  SELECT d::date AS day
  FROM generate_series(current_date - 179, current_date, interval '1 day') AS d
),
caregivers AS (
  SELECT (created_at AT TIME ZONE 'utc')::date AS day, count(*) AS n
  FROM public."Caregiver" GROUP BY 1
),
patients AS (
  SELECT (created_at AT TIME ZONE 'utc')::date AS day, count(*) AS n
  FROM public."Patient" GROUP BY 1
),
sessions AS (
  SELECT (ts.timestamp AT TIME ZONE 'utc')::date AS day,
         count(*) AS n,
         count(DISTINCT ma.patient_id) AS active_patients
  FROM public."TrainingSession" ts
  JOIN public."MemoryAsset" ma ON ma.asset_id = ts.asset_id
  GROUP BY 1
),
recognitions AS (
  SELECT event_date AS day, count(*) AS n
  FROM public."RecognitionEvent" GROUP BY 1
)
SELECT
  days.day,
  coalesce(caregivers.n, 0)              AS new_caregivers,
  coalesce(patients.n, 0)                AS new_patients,
  coalesce(sessions.n, 0)                AS sessions,
  coalesce(sessions.active_patients, 0)  AS active_patients,
  coalesce(recognitions.n, 0)            AS recognitions
FROM days
LEFT JOIN caregivers   ON caregivers.day   = days.day
LEFT JOIN patients     ON patients.day     = days.day
LEFT JOIN sessions     ON sessions.day     = days.day
LEFT JOIN recognitions ON recognitions.day = days.day
WHERE public.is_admin();

-- ── Directory: one row per caregiver ──

CREATE OR REPLACE VIEW public.admin_caregiver_overview WITH (security_invoker = true) AS
SELECT
  c.caregiver_id,
  c.full_name,
  c.email,
  c.caregiver_contact,
  c.image_url,
  c.created_at,
  count(DISTINCT p.patient_id)                                                AS patient_count,
  count(DISTINCT p.patient_id) FILTER (WHERE p.auth_user_id IS NOT NULL)       AS paired_patient_count,
  count(DISTINCT ma.asset_id)                                                 AS asset_count,
  count(ts.session_id)                                                        AS session_count,
  max(ts.timestamp)                                                           AS last_session_at
FROM public."Caregiver" c
LEFT JOIN public."Patient"         p  ON p.caregiver_id = c.caregiver_id
LEFT JOIN public."MemoryAsset"     ma ON ma.patient_id  = p.patient_id
LEFT JOIN public."TrainingSession" ts ON ts.asset_id    = ma.asset_id
WHERE public.is_admin()
GROUP BY c.caregiver_id, c.full_name, c.email, c.caregiver_contact, c.image_url, c.created_at;

-- ── Directory: one row per patient ──
--
-- Adherence comes from DailyReviewEntry as scalar subqueries rather than more joins: TrainingSession
-- and DailyReviewEntry are independent axes off the same patient, and joining both at once would
-- multiply the row counts against each other. ANALYTICS.md is explicit that the two must not be conflated.

CREATE OR REPLACE VIEW public.admin_patient_overview WITH (security_invoker = true) AS
SELECT
  p.patient_id,
  p.patient_name,
  p.date_of_birth,
  p.image_url,
  p.created_at,
  p.caregiver_id,
  c.full_name  AS caregiver_name,
  c.email      AS caregiver_email,
  p.auth_user_id,
  (p.auth_user_id IS NOT NULL) AS is_paired,
  count(DISTINCT ma.asset_id)                                              AS asset_count,
  count(DISTINCT ma.asset_id) FILTER (WHERE ma.status = 'Onboarding')      AS onboarding_count,
  count(DISTINCT ma.asset_id) FILTER (WHERE ma.status = 'Maintenance')     AS maintenance_count,
  count(DISTINCT ma.asset_id) FILTER (WHERE ma.status = 'Paused')          AS paused_count,
  count(ts.session_id)                                                     AS sessions_total,
  count(ts.session_id) FILTER (WHERE ts.success)                           AS sessions_correct,
  max(ts.timestamp)                                                        AS last_session_at,
  (SELECT count(*) FROM public."DailyReviewEntry" d
    WHERE d.patient_id = p.patient_id AND d.queue_date >= current_date - 29)                    AS queued_30d,
  (SELECT count(*) FROM public."DailyReviewEntry" d
    WHERE d.patient_id = p.patient_id AND d.completed AND d.queue_date >= current_date - 29)    AS completed_30d,
  (SELECT max(d.queue_date) FROM public."DailyReviewEntry" d
    WHERE d.patient_id = p.patient_id AND d.completed)                                          AS last_active_day,
  (SELECT count(*) FROM public."Threat" t
    WHERE t.patient_id = p.patient_id AND t.acknowledged_time IS NULL)                          AS open_threats
FROM public."Patient" p
JOIN      public."Caregiver"       c  ON c.caregiver_id = p.caregiver_id
LEFT JOIN public."MemoryAsset"     ma ON ma.patient_id  = p.patient_id
LEFT JOIN public."TrainingSession" ts ON ts.asset_id    = ma.asset_id
WHERE public.is_admin()
GROUP BY p.patient_id, p.patient_name, p.date_of_birth, p.image_url, p.created_at,
         p.caregiver_id, c.full_name, c.email, p.auth_user_id;

-- ── Clinical: raw daily points, one row per patient per day ──
--
-- Deliberately raw. Postgres has regr_slope, but the app smooths with a 7-day rolling average BEFORE
-- fitting the line and then compares against deadbands with sufficiency gates. Recomputing that here
-- would fork the definition of the degradation flag from the one the caregiver sees on their own
-- screen, so the dashboard feeds these points through the app's own helpers instead.

CREATE OR REPLACE VIEW public.admin_patient_daily WITH (security_invoker = true) AS
SELECT
  ma.patient_id,
  (ts.timestamp AT TIME ZONE 'utc')::date                       AS day,
  count(*)                                                      AS sessions,
  count(*) FILTER (WHERE ts.success)                            AS correct,
  (count(*) FILTER (WHERE ts.success))::double precision / count(*) AS accuracy,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY ts.response_latency_ms)
    FILTER (WHERE ts.response_latency_ms IS NOT NULL)           AS median_latency_ms
FROM public."TrainingSession" ts
JOIN public."MemoryAsset" ma ON ma.asset_id = ts.asset_id
WHERE public.is_admin()
  AND ts.timestamp >= now() - interval '90 days'
GROUP BY ma.patient_id, 2;

-- ── Content: assets per patient, against the 45-asset monthly pool cap ──

CREATE OR REPLACE VIEW public.admin_asset_stats WITH (security_invoker = true) AS
SELECT
  ma.patient_id,
  p.patient_name,
  p.caregiver_id,
  count(*)                                              AS total_assets,
  count(*) FILTER (WHERE ma.type = 'Person')            AS person_count,
  count(*) FILTER (WHERE ma.type = 'Object')            AS object_count,
  count(*) FILTER (WHERE ma.status = 'Onboarding')      AS onboarding_count,
  count(*) FILTER (WHERE ma.status = 'Maintenance')     AS maintenance_count,
  count(*) FILTER (WHERE ma.status = 'Paused')          AS paused_count,
  count(*) FILTER (WHERE ma.status <> 'Paused')         AS active_pool_size,
  round(100.0 * count(*) FILTER (WHERE ma.status <> 'Paused') / 45.0, 1) AS pool_utilisation_pct,
  count(*) FILTER (WHERE ma.embedding IS NULL)          AS missing_embedding_count
FROM public."MemoryAsset" ma
JOIN public."Patient" p ON p.patient_id = ma.patient_id
WHERE public.is_admin()
GROUP BY ma.patient_id, p.patient_name, p.caregiver_id;

-- Surfaces vectors left behind by a model bump, which are unusable against the current index.
CREATE OR REPLACE VIEW public.admin_embedding_model_mix WITH (security_invoker = true) AS
SELECT
  ma.type,
  coalesce(ma.embedding_model, 'unknown') AS embedding_model,
  count(*) AS asset_count
FROM public."MemoryAsset" ma
WHERE public.is_admin()
GROUP BY ma.type, coalesce(ma.embedding_model, 'unknown');

-- ── Growth: device pairing funnel ──

CREATE OR REPLACE VIEW public.admin_pairing_funnel WITH (security_invoker = true) AS
SELECT
  count(*)                                                                  AS issued,
  count(*) FILTER (WHERE used_at IS NOT NULL)                               AS used,
  count(*) FILTER (WHERE used_at IS NULL AND expires_at <  now())           AS expired_unused,
  count(*) FILTER (WHERE used_at IS NULL AND expires_at >= now())           AS pending
FROM public."DevicePairing"
WHERE public.is_admin();

-- ── Safety: three incident sources normalised onto one timeline ──

CREATE OR REPLACE VIEW public.admin_incident_feed WITH (security_invoker = true) AS
SELECT
  'threat'::text                AS kind,
  t.threat_type                 AS subtype,
  t.patient_id,
  t.threat_id::text             AS source_id,
  t.detected_time               AS occurred_at,
  t.threat_status               AS status,
  t.acknowledged_time           AS acknowledged_at,
  extract(epoch FROM (t.acknowledged_time - t.detected_time)) AS ack_latency_seconds,
  NULL::text                    AS message
FROM public."Threat" t
WHERE public.is_admin()

UNION ALL

SELECT
  'context_alert'::text,
  coalesce(a.ctxalert_type, 'Reminder'),
  a.patient_id,
  a.ctxalert_id::text,
  a.ctxalert_time,
  a.ctxalert_status,
  a.ack_time,
  extract(epoch FROM (a.ack_time - a.ctxalert_time)),
  a.ctxalert_msg
FROM public."ContextAlert" a
WHERE public.is_admin()

UNION ALL

-- Geofence crossings have no acknowledgement concept, so they carry a null latency and never
-- appear in the unacknowledged filter.
SELECT
  'geofence'::text,
  e.event_type,
  g.patient_id,
  e.geoevent_id::text,
  e.event_time,
  e.event_type,
  e.event_time,
  NULL::double precision,
  NULL::text
FROM public."GeofenceEvent" e
JOIN public."Geofence" g ON g.geofence_id = e.geofence_id
WHERE public.is_admin();

-- ── auth.users fields the dashboard needs ──
--
-- last_sign_in_at and banned_until live in the auth schema, which a security_invoker view cannot read.
-- A SECURITY DEFINER function with its own is_admin() gate rather than a SECURITY DEFINER view, which
-- Supabase's advisor flags and which would have no way to check the caller.

CREATE OR REPLACE FUNCTION public.admin_auth_user_status()
  RETURNS TABLE (
    user_id            uuid,
    email              text,
    last_sign_in_at    timestamptz,
    banned_until       timestamptz,
    email_confirmed_at timestamptz,
    created_at         timestamptz
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
    SELECT u.id, u.email::text, u.last_sign_in_at, u.banned_until, u.email_confirmed_at, u.created_at
    FROM auth.users u;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_auth_user_status() FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_auth_user_status() TO authenticated;

-- ── Grants ──

DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'admin_kpi', 'admin_growth_daily', 'admin_caregiver_overview', 'admin_patient_overview',
    'admin_patient_daily', 'admin_asset_stats', 'admin_embedding_model_mix',
    'admin_pairing_funnel', 'admin_incident_feed'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', v);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v);
  END LOOP;
END $$;
