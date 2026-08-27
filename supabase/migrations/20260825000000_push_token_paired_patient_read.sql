-- Enabling RLS on CaregiverPushToken locked the table to "caregiver_id = auth.uid()", which broke the
-- safety-critical path: the PATIENT device is what reads this token. (patient)/index.tsx reads it for
-- the panic button and FallDetectionService reads it for fall detection, both calling
-- getPushTokenForCaregiver(pairing.caregiverId). Without this the caregiver's remote push is silently
-- dropped and the patient gets only a local notification.
--
-- Mirrors the existing "Caregiver: paired patient reads" policy, which already lets a paired patient
-- read their own caregiver's row. SELECT only: a patient must never write the caregiver's token.
CREATE POLICY "CaregiverPushToken: paired patient reads"
  ON public."CaregiverPushToken"
  FOR SELECT
  TO authenticated
  USING (
    caregiver_id IN (
      SELECT p.caregiver_id FROM public."Patient" p WHERE p.auth_user_id = auth.uid()
    )
  );
