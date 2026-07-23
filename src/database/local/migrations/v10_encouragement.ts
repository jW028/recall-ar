// v10: caregiver-to-patient encouragement messages, delivered to the patient device via pull sync.
// ack_time IS NULL marks a pending message; dismissal soft-acks (hard deletes cannot be pulled).
// caregiver_id has no local FK because the patient device holds no Caregiver row.
export const MIGRATION_V10_ENCOURAGEMENT = `
CREATE TABLE IF NOT EXISTS Encouragement (
    encouragement_id TEXT PRIMARY KEY NOT NULL,
    patient_id       TEXT NOT NULL,
    caregiver_id     TEXT NOT NULL,
    message          TEXT NOT NULL,
    emoji            TEXT,
    created_at       TEXT NOT NULL,
    ack_time         TEXT,
    updated_at       TEXT NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES Patient(patient_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_encouragement_pending ON Encouragement(patient_id, ack_time);
`;
