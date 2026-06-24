export const CREATE_TABLES = `
    -- ─────────────────────────────────────────
    -- 1. CAREGIVER
    -- ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS Caregiver (
        caregiver_id    TEXT PRIMARY KEY NOT NULL,         -- UUID
        full_name       TEXT NOT NULL,
        email           TEXT NOT NULL UNIQUE,
        caregiver_contact TEXT NOT NULL,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─────────────────────────────────────────
    -- 2. PATIENT
    -- ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS Patient (
        patient_id        TEXT PRIMARY KEY NOT NULL,       -- UUID
        caregiver_id      TEXT NOT NULL,
        patient_name      TEXT NOT NULL,
        date_of_birth     TEXT NOT NULL,                   -- ISO-8601 date string YYYY-MM-DD
        medical_notes     TEXT,                            -- nullable, max 2000 chars enforced in app
        emergency_contact TEXT NOT NULL,
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (caregiver_id) REFERENCES Caregiver(caregiver_id) ON DELETE CASCADE
    );

    -- ─────────────────────────────────────────
    -- 3. MEMORY ASSET
    -- [1] embedding stored as JSON TEXT (serialised Float32Array)
    -- [2] CHECK constraints enforce Person/Object field separation
    -- ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS MemoryAsset (
        asset_id          TEXT PRIMARY KEY NOT NULL,       -- UUID
        patient_id        TEXT NOT NULL,
        name              TEXT NOT NULL,
        type              TEXT NOT NULL CHECK (type IN ('Person', 'Object')),
        status            TEXT NOT NULL CHECK (status IN ('Onboarding', 'Maintenance')),
        image_url         TEXT NOT NULL,
        embedding         TEXT NOT NULL,                   -- [1] JSON string of Float32Array
        notes             TEXT NOT NULL,
        current_interval_minutes INTEGER NOT NULL DEFAULT 1,
        next_review       TEXT NOT NULL,                   -- ISO-8601 timestamp
        review_count      INTEGER NOT NULL DEFAULT 0,
    
        -- Person-only fields
        date_of_birth     TEXT,                            -- YYYY-MM-DD, nullable for Objects
        relationship      TEXT,                            -- nullable for Objects
    
        -- Object-only fields
        category          TEXT,                            -- nullable for Persons
        reminder_text     TEXT,                            -- nullable for Persons
    
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    
        -- [2] Enforce type-specific fields
        CHECK (
        (type = 'Person' AND category IS NULL AND reminder_text IS NULL)
        OR
        (type = 'Object' AND date_of_birth IS NULL AND relationship IS NULL)
        ),
    
        FOREIGN KEY (patient_id) REFERENCES Patient(patient_id) ON DELETE CASCADE
    );

    -- ─────────────────────────────────────────
    -- 4. TRAINING SESSION
    -- ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS TrainingSession (
        session_id        TEXT PRIMARY KEY NOT NULL,       -- UUID
        asset_id          TEXT NOT NULL,
        timestamp         TEXT NOT NULL,                   -- ISO-8601 timestamp
        interval_minutes  INTEGER NOT NULL,
        success           INTEGER NOT NULL CHECK (success IN (0, 1)), -- SQLite has no BOOLEAN
        FOREIGN KEY (asset_id) REFERENCES MemoryAsset(asset_id) ON DELETE CASCADE
    );

    -- ─────────────────────────────────────────
    -- 5. DAILY REVIEW ENTRY
    -- [8] Added completed column missing from data dictionary
    -- ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS DailyReviewEntry (
        review_id         TEXT PRIMARY KEY NOT NULL,       -- UUID
        patient_id        TEXT NOT NULL,
        asset_id          TEXT NOT NULL,
        queue_date        TEXT NOT NULL,                   -- YYYY-MM-DD
        position          INTEGER NOT NULL,
        is_onboarding     INTEGER NOT NULL CHECK (is_onboarding IN (0, 1)),
        completed         INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)), -- [8]
        FOREIGN KEY (patient_id) REFERENCES Patient(patient_id) ON DELETE CASCADE,
        FOREIGN KEY (asset_id)   REFERENCES MemoryAsset(asset_id) ON DELETE CASCADE
    );

    -- ─────────────────────────────────────────
    -- 6. COGNITIVE REPORT
    -- ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS CognitiveReport (
        report_id         TEXT PRIMARY KEY NOT NULL,       -- UUID
        patient_id        TEXT NOT NULL,
        generated_date    TEXT NOT NULL,                   -- ISO-8601 timestamp
        report_data       TEXT NOT NULL,                   -- JSON blob
        FOREIGN KEY (patient_id) REFERENCES Patient(patient_id) ON DELETE CASCADE
    );

    -- ─────────────────────────────────────────
    -- 7. GEOFENCE
    -- ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS Geofence (
        geofence_id       TEXT PRIMARY KEY NOT NULL,       -- UUID
        patient_id        TEXT NOT NULL,
        center_latitude   REAL NOT NULL,
        center_longitude  REAL NOT NULL,                   -- [3] corrected spelling
        radius_meters     INTEGER NOT NULL,
        geofence_type     TEXT NOT NULL,                   -- e.g. 'Home'
        FOREIGN KEY (patient_id) REFERENCES Patient(patient_id) ON DELETE CASCADE
    );

    -- ─────────────────────────────────────────
    -- 8. GEOFENCE EVENT
    -- ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS GeofenceEvent (
        geoEvent_id       TEXT PRIMARY KEY NOT NULL,       -- UUID
        geofence_id       TEXT NOT NULL,
        event_type        TEXT NOT NULL CHECK (event_type IN ('Enter', 'Exit')),
        event_time        TEXT NOT NULL,                   -- ISO-8601 timestamp
        FOREIGN KEY (geofence_id) REFERENCES Geofence(geofence_id) ON DELETE CASCADE
    );

    -- ─────────────────────────────────────────
    -- 9. THREAT
    -- [4] acknowledged_time kept nullable — acknowledgement may never occur
    -- ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS Threat (
        threat_id         TEXT PRIMARY KEY NOT NULL,       -- UUID
        patient_id        TEXT NOT NULL,
        threat_type       TEXT NOT NULL,
        detected_time     TEXT NOT NULL,                   -- ISO-8601 timestamp
        threat_status     TEXT NOT NULL,
        alert_status      TEXT NOT NULL,
        alert_time        TEXT NOT NULL,                   -- ISO-8601 timestamp
        acknowledged_time TEXT,                            -- nullable — may never be acknowledged
        FOREIGN KEY (patient_id) REFERENCES Patient(patient_id) ON DELETE CASCADE
    );

    -- ─────────────────────────────────────────
    -- 10. CONTEXT ALERT
    -- [5] ctxAlert_time changed to NOT NULL — must always be set on creation
    -- ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS ContextAlert (
        ctxAlert_id       TEXT PRIMARY KEY NOT NULL,       -- UUID
        patient_id        TEXT NOT NULL,
        asset_id          TEXT,                            -- nullable (alert may not relate to an asset)
        ctxAlert_msg      TEXT NOT NULL,
        ctxAlert_status   TEXT NOT NULL,
        ctxAlert_time     TEXT NOT NULL DEFAULT (datetime('now')), -- [5] NOT NULL
        ack_time          TEXT,                            -- nullable — may not be acknowledged
        ack_status        TEXT NOT NULL,
        frequency         TEXT NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES Patient(patient_id) ON DELETE CASCADE,
        FOREIGN KEY (asset_id)   REFERENCES MemoryAsset(asset_id) ON DELETE SET NULL
    );

    -- ─────────────────────────────────────────
    -- 11. SYNC LOG  (new — not in original doc)
    -- [7] Tracks sync state per row for SyncService offline-first operation
    -- ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS SyncLog (
        sync_id           TEXT PRIMARY KEY NOT NULL,       -- UUID
        table_name        TEXT NOT NULL,
        row_id            TEXT NOT NULL,                   -- UUID of the synced row
        operation         TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
        synced            INTEGER NOT NULL DEFAULT 0 CHECK (synced IN (0, 1)),
        last_attempt      TEXT,                            -- ISO-8601 timestamp
        error_message     TEXT,                            -- last sync error if any
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (table_name, row_id, operation)
    );

    -- ─────────────────────────────────────────
    -- INDEXES — for AR query and training performance
    -- ─────────────────────────────────────────
    
    -- AR recognition: fetch all embeddings for a patient fast
    CREATE INDEX IF NOT EXISTS idx_asset_patient
        ON MemoryAsset(patient_id);
    
    -- Training scheduler: find assets due for review
    CREATE INDEX IF NOT EXISTS idx_asset_next_review
        ON MemoryAsset(patient_id, next_review);
    
    -- Daily queue lookup by date
    CREATE INDEX IF NOT EXISTS idx_review_queue_date
        ON DailyReviewEntry(patient_id, queue_date);
    
    -- Analytics: session history per asset
    CREATE INDEX IF NOT EXISTS idx_session_asset
        ON TrainingSession(asset_id, timestamp);
    
    -- SyncService: find unsynced rows quickly
    CREATE INDEX IF NOT EXISTS idx_sync_unsynced
        ON SyncLog(synced, table_name);
    
`;