// v9: append-only log of confirmed AR recognitions, one row per asset per local day.
// event_date is the device-local YYYY-MM-DD; the UNIQUE constraint is the durable per-day de-dupe.
export const MIGRATION_V9_RECOGNITION_EVENT = `
CREATE TABLE IF NOT EXISTS RecognitionEvent (
    recognition_id  TEXT PRIMARY KEY NOT NULL,
    patient_id      TEXT NOT NULL,
    asset_id        TEXT NOT NULL,
    event_date      TEXT NOT NULL,
    event_time      TEXT NOT NULL,
    UNIQUE (patient_id, asset_id, event_date),
    FOREIGN KEY (patient_id) REFERENCES Patient(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES MemoryAsset(asset_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_recognition_patient_date ON RecognitionEvent(patient_id, event_date);
`;
