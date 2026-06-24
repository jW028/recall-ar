export const MIGRATION_V7_ASSET_PAUSE = `

  -- Widen MemoryAsset.status to allow 'Paused' and add paused_from for correct resume.
  -- SQLite can't alter a CHECK constraint in place, so recreate the table (12-step rebuild).
  -- Note: photo_urls was added in v3 (not in the v1 baseline) — it must be carried over here.

  -- Step 1: Create the new table with the widened status CHECK and the new paused_from column.
  CREATE TABLE IF NOT EXISTS MemoryAsset_new (
      asset_id          TEXT PRIMARY KEY NOT NULL,
      patient_id        TEXT NOT NULL,
      name              TEXT NOT NULL,
      type              TEXT NOT NULL CHECK (type IN ('Person', 'Object')),
      status            TEXT NOT NULL CHECK (status IN ('Onboarding', 'Maintenance', 'Paused')),
      image_url         TEXT NOT NULL,
      embedding         TEXT NOT NULL,
      notes             TEXT NOT NULL,
      current_interval_minutes INTEGER NOT NULL DEFAULT 1,
      next_review       TEXT NOT NULL,
      review_count      INTEGER NOT NULL DEFAULT 0,
      date_of_birth     TEXT,
      relationship      TEXT,
      category          TEXT,
      reminder_text     TEXT,
      photo_urls        TEXT,
      paused_from       TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now')),

      CHECK (
        (type = 'Person' AND category IS NULL AND reminder_text IS NULL)
        OR
        (type = 'Object' AND date_of_birth IS NULL AND relationship IS NULL)
      ),

      FOREIGN KEY (patient_id) REFERENCES Patient(patient_id) ON DELETE CASCADE
  );

  -- Step 2: Copy existing rows (paused_from defaults to NULL).
  INSERT OR IGNORE INTO MemoryAsset_new
    (asset_id, patient_id, name, type, status, image_url, embedding, notes,
     current_interval_minutes, next_review, review_count,
     date_of_birth, relationship, category, reminder_text, photo_urls, created_at, updated_at)
  SELECT
    asset_id, patient_id, name, type, status, image_url, embedding, notes,
    current_interval_minutes, next_review, review_count,
    date_of_birth, relationship, category, reminder_text, photo_urls, created_at, updated_at
  FROM MemoryAsset;

  -- Step 3: Drop the old table and rename the new one.
  DROP TABLE MemoryAsset;
  ALTER TABLE MemoryAsset_new RENAME TO MemoryAsset;

`;
