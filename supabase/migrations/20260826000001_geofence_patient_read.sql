-- Let a patient device read its own Geofence rows, which is what makes "GeofenceEvent: patient self" work at all.
--
-- That policy checks geofence_id against a subquery over Geofence, and a policy subquery is evaluated with the caller's own permissions, so RLS on Geofence applies inside it.
-- Geofence had only "Geofence: caregiver owns patient" and "Geofence: admin read", so on a patient device the subquery matched zero rows and its WITH CHECK could never pass.
-- Every GeofenceEvent the patient device records via LocationService.publishLocation -> GeofenceService.evaluatePatientLocationAndRecordEvents would have been rejected with "new row violates row-level security policy", exactly like the MemoryAsset and ContextAlert pushes.
--
-- This is latent rather than firing today only because GeofenceService.getGeofencesByPatient reads local SQLite and nothing populates the patient device's local Geofence table.
-- pullGeofencesFromCloud is only called from the caregiver's geofence screen, and Geofence is not in SyncService's PULL_ORDER.
-- The read policy is the server-side half of the fix and has to land either way, since the patient device cannot pull a geofence it is not allowed to select.
--
-- SELECT only: the patient device never creates, edits, or deletes a safe zone. Those all stay caregiver-owned.

CREATE POLICY "Geofence: patient self read"
  ON public."Geofence"
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT "Patient".patient_id FROM public."Patient"
      WHERE "Patient".auth_user_id = auth.uid()
    )
  );
