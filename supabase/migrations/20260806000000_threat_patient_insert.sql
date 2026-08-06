-- Let a patient device record its own threats.
--
-- "Threat: caregiver owns patient" is FOR ALL with a null WITH CHECK, so Postgres uses its USING
-- expression as the INSERT check as well. That expression resolves a caregiver_id from auth.uid(),
-- which never matches on a patient device — so the panic button in (patient)/index.tsx wrote a
-- Threat to local SQLite, queued it, and then had every push rejected by RLS. The row stayed in
-- SyncLog and was retried every 30s forever, and the caregiver was never alerted.
--
-- Scoped to the patient's own rows via Patient.auth_user_id, matching the existing
-- "TrainingSession: patient self" and "RecognitionEvent: patient self" policies. FOR ALL rather
-- than FOR INSERT because SyncService pushes with upsert(onConflict), so a retry of an
-- already-pushed row needs UPDATE too.

CREATE POLICY "Threat: patient self"
  ON public."Threat"
  FOR ALL
  USING (
    patient_id IN (
      SELECT "Patient".patient_id
      FROM public."Patient"
      WHERE "Patient".auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    patient_id IN (
      SELECT "Patient".patient_id
      FROM public."Patient"
      WHERE "Patient".auth_user_id = auth.uid()
    )
  );
