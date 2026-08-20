-- Give a caregiver a profile picture, so the Account screen can show a real avatar instead of an initial.
--
-- Mirrors Patient.image_url: a nullable text column holding the public URL of an object in a
-- public storage bucket. No RLS change is needed on "Caregiver" itself — "Caregiver: own row only"
-- is FOR ALL with a null WITH CHECK, so Postgres reuses its USING expression for the update check.
--
-- The bucket is separate from patient-avatars because that bucket's policies grant every
-- authenticated user write access to the whole bucket. These are scoped to the uploader's own
-- folder, which is what CaregiverService.uploadProfilePicture writes to ({caregiver_id}/{uuid}.ext).

ALTER TABLE public."Caregiver" ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('caregiver-avatars', 'caregiver-avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read caregiver avatars"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'caregiver-avatars');

CREATE POLICY "Caregiver writes own avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'caregiver-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Caregiver updates own avatar"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'caregiver-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Caregiver deletes own avatar"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'caregiver-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
