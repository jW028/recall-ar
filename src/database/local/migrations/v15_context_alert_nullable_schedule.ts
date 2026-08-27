export const MIGRATION_V15_CONTEXT_ALERT_NULLABLE_SCHEDULE = `
    -- SQLite does not allow modifying column constraints (dropping NOT NULL) directly via ALTER TABLE.
    -- We create ContextAlert_new with nullable ctxAlert_time and frequency, copy data, and swap tables.

    CREATE TABLE IF NOT EXISTS ContextAlert_new (
        ctxAlert_id       TEXT PRIMARY KEY NOT NULL,
        patient_id        TEXT NOT NULL,
        asset_id          TEXT,
        ctxAlert_msg      TEXT NOT NULL,
        ctxAlert_desc     TEXT,
        ctxAlert_type     TEXT NOT NULL DEFAULT 'Reminder',
        ctxAlert_status   TEXT NOT NULL,
        ctxAlert_time     TEXT,
        ack_time          TEXT,
        ack_status        TEXT NOT NULL,
        frequency         TEXT,
        FOREIGN KEY (patient_id) REFERENCES Patient(patient_id) ON DELETE CASCADE,
        FOREIGN KEY (asset_id)   REFERENCES MemoryAsset(asset_id) ON DELETE SET NULL
    );

    INSERT OR IGNORE INTO ContextAlert_new
        (ctxAlert_id, patient_id, asset_id, ctxAlert_msg, ctxAlert_desc, ctxAlert_type, ctxAlert_status, ctxAlert_time, ack_time, ack_status, frequency)
    SELECT
        ctxAlert_id,
        patient_id,
        asset_id,
        ctxAlert_msg,
        NULL,
        'Reminder',
        ctxAlert_status,
        ctxAlert_time,
        ack_time,
        ack_status,
        frequency
    FROM ContextAlert;

    DROP TABLE ContextAlert;
    ALTER TABLE ContextAlert_new RENAME TO ContextAlert;
`;
