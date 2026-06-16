export const MIGRATION_V2_DEVICE_PAIRING = `
 
  CREATE TABLE IF NOT EXISTS DevicePairing (
    pairing_id      TEXT  PRIMARY KEY NOT NULL,   -- UUID, mirrors Supabase pairing_id
    patient_id      TEXT  NOT NULL,               -- UUID
    caregiver_id    TEXT  NOT NULL,               -- UUID
    device_label    TEXT,                         -- e.g. "Mary's iPad"
    paired_at       TEXT  NOT NULL,               -- ISO-8601 timestamp
    FOREIGN KEY (patient_id) REFERENCES Patient(patient_id) ON DELETE CASCADE
  );
 
`;
