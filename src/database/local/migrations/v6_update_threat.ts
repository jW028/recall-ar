export const MIGRATION_V6_UPDATE_THREAT = `

  -- SQLite does not support DROP COLUMN directly on tables with foreign keys or
  -- CHECK constraints, so we recreate the table without geoEvent_id and track_id.

  -- Step 1: Create the new Threat table without the removed columns
  CREATE TABLE IF NOT EXISTS Threat_new (
    threat_id         TEXT PRIMARY KEY NOT NULL,
    patient_id        TEXT NOT NULL,
    threat_type       TEXT NOT NULL,
    detected_time     TEXT NOT NULL,
    threat_status     TEXT NOT NULL,
    alert_status      TEXT NOT NULL,
    alert_time        TEXT NOT NULL,
    acknowledged_time TEXT,
    FOREIGN KEY (patient_id) REFERENCES Patient(patient_id) ON DELETE CASCADE
  );

  -- Step 2: Copy existing rows (excluding the dropped columns)
  INSERT OR IGNORE INTO Threat_new
    (threat_id, patient_id, threat_type, detected_time, threat_status, alert_status, alert_time, acknowledged_time)
  SELECT
    threat_id, patient_id, threat_type, detected_time, threat_status, alert_status, alert_time, acknowledged_time
  FROM Threat;

  -- Step 3: Drop the old table and rename the new one
  DROP TABLE Threat;
  ALTER TABLE Threat_new RENAME TO Threat;

`;
