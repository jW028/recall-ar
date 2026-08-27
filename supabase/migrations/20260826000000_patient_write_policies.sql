-- Let a patient device push the rows it legitimately writes: its own MemoryAsset review state and its own ContextAlert acknowledgements.
--
-- "MemoryAsset: patient self read" and "ContextAlert: patient self read" are both FOR SELECT, so the patient device could read those rows but never push a change back.
-- TrainingService.submitAnswer writes the spaced-repetition fields (current_interval_minutes, next_review, review_count) and queues a MemoryAsset UPDATE.
-- ContextAlertService.acknowledgeContextAlert and the frequency reset in getContextAlertsForPatient both queue a ContextAlert UPDATE.
-- Every one of those pushes was rejected with "new row violates row-level security policy", left unsynced in SyncLog, and retried every 30s forever.
--
-- INSERT is required as well as UPDATE even though the patient device only ever updates an existing row.
-- SyncService.pushRow sends upsert(onConflict), which Postgres runs as INSERT ... ON CONFLICT DO UPDATE, and the INSERT WITH CHECK policy is evaluated on the proposed tuple before the conflict is detected.
-- With no INSERT policy the statement fails on a row that already exists, which is exactly the error above.
--
-- Split into FOR INSERT and FOR UPDATE rather than the FOR ALL used by "Threat: patient self", because neither table is ever deleted from the patient device and DELETE does not need to be granted.

CREATE POLICY "MemoryAsset: patient self insert"
  ON public."MemoryAsset"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id IN (
      SELECT "Patient".patient_id FROM public."Patient"
      WHERE "Patient".auth_user_id = auth.uid()
    )
  );

CREATE POLICY "MemoryAsset: patient self update"
  ON public."MemoryAsset"
  FOR UPDATE
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

CREATE POLICY "ContextAlert: patient self insert"
  ON public."ContextAlert"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id IN (
      SELECT "Patient".patient_id FROM public."Patient"
      WHERE "Patient".auth_user_id = auth.uid()
    )
  );

CREATE POLICY "ContextAlert: patient self update"
  ON public."ContextAlert"
  FOR UPDATE
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
