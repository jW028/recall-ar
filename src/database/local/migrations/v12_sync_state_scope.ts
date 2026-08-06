export const MIGRATION_V12_SYNC_STATE_SCOPE = `

  -- v4's SyncState was keyed on table_name alone, but a pull is scoped (by patient_id, or by caregiver_id for the Patient table). A caregiver with two patients would pull the first, advance the shared watermark past the second's older rows, and never fetch them. The key now includes the scope value so each scope tracks its own high-water mark.
  DROP TABLE IF EXISTS SyncState;

  CREATE TABLE SyncState (
    table_name      TEXT NOT NULL,
    scope_key       TEXT NOT NULL DEFAULT '',
    last_pulled_at  TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
    PRIMARY KEY (table_name, scope_key)
  );

`;
